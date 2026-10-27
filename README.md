# CYBERDECK // Red Alert Desktop Dashboard

Локальный вертикальный HUD для Windows, рассчитанный на экран 1080×1920 и запуск в браузере, Lively Wallpaper или Wallpaper Engine.

## Быстрый запуск

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```

Откройте `http://127.0.0.1:8765`. Кнопка `EDIT MODE` включает перемещение, изменение размера, скрытие и дублирование блоков. Раскладка сохраняется в браузере.

## Что уже работает

- реальные CPU/RAM/диски/сеть/uptime и список процессов через `psutil`;
- GPU NVIDIA через `nvidia-smi`, если утилита доступна;
- WebSocket-обновления без перезагрузки;
- вертикальная красная тема Red Alert;
- режим редактирования, экспорт/импорт раскладки;
- демонстрационный fallback, если сервер телеметрии недоступен.

## Архитектура

- `app/main.py` — локальный API, WebSocket и раздача интерфейса;
- `app/telemetry.py` — независимый провайдер системных метрик;
- `app/static/` — клиент и виджеты;
- `data/dashboard.json` — серверная конфигурация по умолчанию.

Секреты внешних интеграций в клиент не добавляются: OAuth-токены и API-ключи должны храниться только на Python-стороне (в `.env` или Windows Credential Manager).

## Интеграция с живыми обоями

Для разработки удобнее Lively Wallpaper: добавьте URL `http://127.0.0.1:8765` и запускайте сервер вместе с Windows. Для Wallpaper Engine можно использовать тот же URL или позднее упаковать статический клиент, оставив Python как локальный telemetry bridge.
