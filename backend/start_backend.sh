#!/bin/bash
source ~/.pyenv/versions/3.11.8/envs/helpnet-env/bin/activate
python manage.py runserver 0.0.0.0:8000 > server.log 2>&1 &
echo "Started"
