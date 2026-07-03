#!/usr/bin/env python3
"""Train and run per-house LSTM energy prediction.

The script reads raw PZEM data from PostgreSQL, aggregates daily kWh per house,
trains one LSTM model per house, predicts the next period, and stores the
monthly result in prediksi_bulanan.
"""

from __future__ import annotations

import argparse
import json
import math
import os
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import psycopg2
import psycopg2.extras
import tensorflow as tf
from dotenv import load_dotenv
from sklearn.metrics import mean_absolute_percentage_error
from sklearn.preprocessing import MinMaxScaler


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_SEQUENCE_LENGTH = 14
DEFAULT_HORIZON_DAYS = 30
DEFAULT_EPOCHS = 80
DEFAULT_BATCH_SIZE = 8


@dataclass
class PredictionResult:
    rumah_id: str
    nama_rumah: str
    bulan: int
    tahun: int
    prediksi_energi_kwh: float
    prediksi_biaya: float
    akurasi: float | None
    training_days: int
    jumlah_perangkat: int


def load_environment() -> None:
    load_dotenv(ROOT_DIR / ".env")


def get_connection():
    load_environment()

    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME", "monitoring_listrik"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
    )


def fetch_daily_house_usage(connection, rumah_id: str | None = None) -> pd.DataFrame:
    params: list[Any] = []
    where = ""

    if rumah_id:
        params.append(rumah_id)
        where = "WHERE p.rumah_id = %s"

    query = f"""
        WITH device_daily AS (
          SELECT
            p.rumah_id,
            r.nama_rumah,
            DATE(dl.waktu_baca) AS tanggal,
            dl.device_id,
            CASE
              WHEN COUNT(*) > 1 THEN GREATEST(MAX(dl.energi) - MIN(dl.energi), 0)
              ELSE COALESCE(MAX(dl.energi), 0)
            END AS energi_kwh,
            AVG(dl.daya) AS rata_daya,
            MAX(dl.daya) AS daya_maksimum
          FROM data_listrik dl
          JOIN perangkat p ON p.device_id = dl.device_id
          JOIN rumah r ON r.id = p.rumah_id
          {where}
          GROUP BY p.rumah_id, r.nama_rumah, DATE(dl.waktu_baca), dl.device_id
        ),
        house_device_context AS (
          SELECT
            r.id AS rumah_id,
            COUNT(p.id)::int AS jumlah_perangkat,
            COUNT(p.id) FILTER (WHERE p.status_online = TRUE)::int AS perangkat_online,
            COUNT(p.id) FILTER (WHERE p.status_relay = TRUE)::int AS relay_on
          FROM rumah r
          LEFT JOIN perangkat p ON p.rumah_id = r.id
          GROUP BY r.id
        )
        SELECT
          dd.rumah_id,
          dd.nama_rumah,
          dd.tanggal,
          SUM(dd.energi_kwh)::float AS energi_kwh,
          AVG(dd.rata_daya)::float AS rata_daya,
          MAX(dd.daya_maksimum)::float AS daya_maksimum,
          hdc.jumlah_perangkat,
          hdc.perangkat_online,
          hdc.relay_on
        FROM device_daily dd
        JOIN house_device_context hdc ON hdc.rumah_id = dd.rumah_id
        GROUP BY
          dd.rumah_id,
          dd.nama_rumah,
          dd.tanggal,
          hdc.jumlah_perangkat,
          hdc.perangkat_online,
          hdc.relay_on
        ORDER BY dd.rumah_id, dd.tanggal
    """

    return pd.read_sql_query(query, connection, params=params)


def fetch_tariff_map(connection) -> dict[str, float]:
    query = """
        SELECT DISTINCT ON (rumah_id)
          rumah_id,
          harga_per_kwh
        FROM tarif_listrik
        WHERE COALESCE(status, 'Aktif') <> 'Nonaktif'
        ORDER BY rumah_id, created_at DESC
    """
    rows = pd.read_sql_query(query, connection)

    return {
        str(row["rumah_id"]): float(row["harga_per_kwh"])
        for _, row in rows.iterrows()
    }


def add_time_features(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.copy()
    result["tanggal"] = pd.to_datetime(result["tanggal"])
    day_of_week = result["tanggal"].dt.dayofweek
    result["dow_sin"] = np.sin(2 * np.pi * day_of_week / 7)
    result["dow_cos"] = np.cos(2 * np.pi * day_of_week / 7)
    result["energi_kwh"] = result["energi_kwh"].clip(lower=0)
    result["rata_daya"] = result["rata_daya"].fillna(0)
    result["daya_maksimum"] = result["daya_maksimum"].fillna(0)

    return result


def build_sequences(values: np.ndarray, sequence_length: int):
    x_rows = []
    y_rows = []

    for index in range(sequence_length, len(values)):
        x_rows.append(values[index - sequence_length:index])
        y_rows.append(values[index, 0])

    return np.asarray(x_rows), np.asarray(y_rows)


def build_model(sequence_length: int, feature_count: int) -> tf.keras.Model:
    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(sequence_length, feature_count)),
            tf.keras.layers.LSTM(48, return_sequences=True),
            tf.keras.layers.Dropout(0.15),
            tf.keras.layers.LSTM(24),
            tf.keras.layers.Dense(16, activation="relu"),
            tf.keras.layers.Dense(1),
        ]
    )
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss="mse",
        metrics=["mae"],
    )

    return model


def forecast_house(
    house_frame: pd.DataFrame,
    tariff_price: float,
    horizon_days: int,
    sequence_length: int,
    epochs: int,
    batch_size: int,
) -> PredictionResult | None:
    house_frame = add_time_features(house_frame).sort_values("tanggal")

    if len(house_frame) <= sequence_length + 2:
        return None

    feature_columns = [
        "energi_kwh",
        "rata_daya",
        "daya_maksimum",
        "jumlah_perangkat",
        "perangkat_online",
        "relay_on",
        "dow_sin",
        "dow_cos",
    ]
    feature_values = house_frame[feature_columns].astype(float).to_numpy()
    scaler = MinMaxScaler()
    scaled_values = scaler.fit_transform(feature_values)
    x_rows, y_rows = build_sequences(scaled_values, sequence_length)

    validation_size = max(1, math.floor(len(x_rows) * 0.2))
    x_train = x_rows[:-validation_size]
    y_train = y_rows[:-validation_size]
    x_val = x_rows[-validation_size:]
    y_val = y_rows[-validation_size:]

    if len(x_train) == 0:
        x_train = x_rows
        y_train = y_rows
        x_val = x_rows[-1:]
        y_val = y_rows[-1:]

    tf.keras.utils.set_random_seed(42)
    model = build_model(sequence_length, len(feature_columns))
    model.fit(
        x_train,
        y_train,
        validation_data=(x_val, y_val),
        epochs=epochs,
        batch_size=batch_size,
        verbose=0,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(
                monitor="val_loss",
                patience=12,
                restore_best_weights=True,
            )
        ],
    )

    validation_prediction = model.predict(x_val, verbose=0).reshape(-1)
    validation_actual = inverse_energy_values(y_val, scaler, len(feature_columns))
    validation_predicted = inverse_energy_values(
        validation_prediction,
        scaler,
        len(feature_columns),
    )
    mape = mean_absolute_percentage_error(
        np.maximum(validation_actual, 0.001),
        np.maximum(validation_predicted, 0),
    )
    accuracy = max(0, 100 - (mape * 100))

    last_sequence = scaled_values[-sequence_length:].copy()
    forecast_energy: list[float] = []
    last_date = house_frame["tanggal"].max().date()
    context = house_frame.iloc[-1]

    for step in range(1, horizon_days + 1):
        predicted_scaled_energy = float(
            model.predict(last_sequence[np.newaxis, :, :], verbose=0)[0][0]
        )
        next_date = last_date + timedelta(days=step)
        context_scaled = scaler.transform(
            np.array(
                [
                    [
                        0,
                        0,
                        0,
                        context["jumlah_perangkat"],
                        context["perangkat_online"],
                        context["relay_on"],
                        math.sin(2 * math.pi * next_date.weekday() / 7),
                        math.cos(2 * math.pi * next_date.weekday() / 7),
                    ]
                ]
            )
        )[0]
        next_row = np.array(
            [
                predicted_scaled_energy,
                last_sequence[-1, 1],
                last_sequence[-1, 2],
                context_scaled[3],
                context_scaled[4],
                context_scaled[5],
                context_scaled[6],
                context_scaled[7],
            ]
        )
        energy_kwh = max(
            0,
            inverse_energy_values(
                np.array([predicted_scaled_energy]),
                scaler,
                len(feature_columns),
            )[0],
        )

        forecast_energy.append(float(energy_kwh))
        last_sequence = np.vstack([last_sequence[1:], next_row])

    target_month_date = last_date + timedelta(days=horizon_days)
    predicted_kwh = float(np.sum(forecast_energy))

    return PredictionResult(
        rumah_id=str(context["rumah_id"]),
        nama_rumah=str(context["nama_rumah"]),
        bulan=target_month_date.month,
        tahun=target_month_date.year,
        prediksi_energi_kwh=round(predicted_kwh, 4),
        prediksi_biaya=round(predicted_kwh * tariff_price, 2),
        akurasi=round(float(accuracy), 2),
        training_days=len(house_frame),
        jumlah_perangkat=int(context["jumlah_perangkat"]),
    )


def inverse_energy_values(
    scaled_energy: np.ndarray,
    scaler: MinMaxScaler,
    feature_count: int,
) -> np.ndarray:
    padded = np.zeros((len(scaled_energy), feature_count))
    padded[:, 0] = scaled_energy

    return scaler.inverse_transform(padded)[:, 0]


def save_prediction(connection, prediction: PredictionResult) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO prediksi_bulanan
              (rumah_id, bulan, tahun, prediksi_energi_kwh, prediksi_biaya, nama_model, akurasi)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (rumah_id, bulan, tahun)
            DO UPDATE SET
              prediksi_energi_kwh = EXCLUDED.prediksi_energi_kwh,
              prediksi_biaya = EXCLUDED.prediksi_biaya,
              nama_model = EXCLUDED.nama_model,
              akurasi = EXCLUDED.akurasi,
              created_at = NOW()
            """,
            (
                prediction.rumah_id,
                prediction.bulan,
                prediction.tahun,
                prediction.prediksi_energi_kwh,
                prediction.prediksi_biaya,
                "Python LSTM",
                prediction.akurasi,
            ),
        )
    connection.commit()


def run(args: argparse.Namespace) -> list[PredictionResult]:
    connection = get_connection()

    try:
        daily_usage = fetch_daily_house_usage(connection, args.rumah_id)
        tariff_map = fetch_tariff_map(connection)
        results: list[PredictionResult] = []

        if daily_usage.empty:
            return results

        for rumah_id, house_frame in daily_usage.groupby("rumah_id"):
            tariff_price = tariff_map.get(str(rumah_id), args.default_tariff)
            prediction = forecast_house(
                house_frame=house_frame,
                tariff_price=tariff_price,
                horizon_days=args.horizon_days,
                sequence_length=args.sequence_length,
                epochs=args.epochs,
                batch_size=args.batch_size,
            )

            if not prediction:
                continue

            results.append(prediction)

            if not args.dry_run:
                save_prediction(connection, prediction)

        return results
    finally:
        connection.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train LSTM and save monthly energy predictions per house."
    )
    parser.add_argument("--rumah-id", help="Predict only one rumah_id.")
    parser.add_argument("--horizon-days", type=int, default=DEFAULT_HORIZON_DAYS)
    parser.add_argument("--sequence-length", type=int, default=DEFAULT_SEQUENCE_LENGTH)
    parser.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS)
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--default-tariff", type=float, default=1444.7)
    parser.add_argument("--dry-run", action="store_true")

    return parser.parse_args()


def main() -> None:
    args = parse_args()
    results = run(args)

    print(
        json.dumps(
            [result.__dict__ for result in results],
            indent=2,
            default=str,
        )
    )


if __name__ == "__main__":
    main()
