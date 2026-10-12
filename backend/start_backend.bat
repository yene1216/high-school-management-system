@echo off
call venv\Scripts\activate
set "DJANGO_DEBUG=1"
set "EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend"
set "EMAIL_HOST=smtp.gmail.com"
set "EMAIL_PORT=587"
set "EMAIL_USE_TLS=1"
set "EMAIL_HOST_USER=yenesewenyew47@gmail.com"
set "EMAIL_HOST_PASSWORD=uefyolrlqlzfgclw"
set "DEFAULT_FROM_EMAIL=Yohanis Children Academy <yenesewenyew47@gmail.com>"
python manage.py runserver
