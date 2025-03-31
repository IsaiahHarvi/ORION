#!/bin/bash

git checkout stable
git pull origin stable

docker compose up --build -d

