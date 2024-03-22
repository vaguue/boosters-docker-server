#!/bin/bash

set -x

logFile=$HOME/.pm2/logs/rabbitmq-out.log

startDocker() {
  if [ -z "$(docker images -q myrabbitmq)" ]; then
    echo [*] building image
    docker build -t myrabbitmq:latest .
  fi

  pm2 delete rabbitmq &> /dev/null

  pm2 --name rabbitmq --interpreter=python3 start docker-compose -- up &> /dev/null

  while [ -z "$(docker ps | grep rabbitmq)" ]; do
    sleep 1
  done
  while [ -z "$(cat $logFile | grep 'started TCP listener on')" ]; do
    sleep 1
  done
  echo [*] started container
}

enablePlugins() {
  docker exec rabbitmq rabbitmq-plugins enable rabbitmq_management
}

regUser() {
  docker exec rabbitmq rabbitmqctl add_user 'boostpro' 'ofibet'
  docker exec rabbitmq rabbitmqctl set_user_tags 'boostpro' administrator
  docker exec rabbitmq rabbitmqctl set_permissions -p '/' 'boostpro' '.*' '.*' '.*'
  echo [*] user added successfully
}

startDocker && enablePlugins && regUser
