# LSTM Prediksi Konsumsi Listrik

Script `lstm_energy_prediction.py` membaca data dari PostgreSQL, membuat agregasi harian per rumah, melatih LSTM, lalu menyimpan hasil ke tabel `prediksi_bulanan`.

## Setup

```bash
cd /root/BE-MonitoringListrik
python3 -m venv .venv
source .venv/bin/activate
pip install -r ml/requirements.txt
```

## Jalankan Prediksi

```bash
python ml/lstm_energy_prediction.py
```

Mode cek tanpa simpan database:

```bash
python ml/lstm_energy_prediction.py --dry-run
```

Prediksi satu rumah:

```bash
python ml/lstm_energy_prediction.py --rumah-id <UUID_RUMAH>
```

## Cron Harian

```bash
0 1 * * * cd /root/BE-MonitoringListrik && /root/BE-MonitoringListrik/.venv/bin/python ml/lstm_energy_prediction.py >> logs/lstm.log 2>&1
```
