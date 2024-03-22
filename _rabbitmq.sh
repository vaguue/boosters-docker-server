#!/bin/bash

#TODO write pull function + run rabbitmq-plugins enable rabbitmq_management + run echo 'ofibet' | rabbitmqctl add_user 'boostpro'

logFile=$HOME/.pm2/logs/rabbitmq-out.log
start_flags='--name rabbitmq -p 5672:5672 -p 15672:15672'

fetchDate() {
  if [ "$1" -eq 1 ]; then
    date -d "$(echo $2 | cut -d ':' -f 1,2,3)" +%s
  elif [ "$1" -eq 2 ]; then
    date -d "$(echo $2 | cut -d ':' -f 2,3,4)" +%s
  fi
}

filterLogs() {
# $1 - now, $2 log str
#looking for 10773:2022-02-18 13:03:43.239455+00:00 [info] <0.749.0> started TCP listener on [::]:5672
  fetchDate 2 "$2" &> /dev/null
  if [ "$?" -eq 0 ]; then
    logDate=$(fetchDate 2 "$2")
    #echo $logDate
  else
    fetchDate 1 "$2" &> /dev/null
    if [ "$?" -eq 0 ]; then
      logDate=$(fetchDate 1 "$2")
      #echo $logDate
    fi
  fi
  if [ -n "$logDate" ]; then
    if [ "$logDate" -ge "$1" ]; then
      echo $logDate
    fi
  fi
}

startDocker() {
  if [ -z "$(docker images -q rabbitmq)" ]; then
    echo [*] pulling image
    docker pull rabbitmq
  fi
  #pm2 delete rabbitmq &> /dev/null
  pm2 delete rabbitmq
  docker kill $(docker ps -a | grep rabbitmq | awk '{print $1}') &> /dev/null
  docker rm $(docker ps -a | grep rabbitmq | awk '{print $1}') &> /dev/null
  #now=$(date +%s)
  rm $logFile
  pm2 --name rabbitmq start docker -- run --rm $start_flags rabbitmq &> /dev/null
  while [ -z "$(docker ps | grep rabbitmq)" ]; do
    sleep 1
  done
  while [ -z "$(cat $logFile | grep 'started TCP listener on')" ]; do
    sleep 1
  done
  echo [*] started container
  #while read line; do
  #  filterLogs $now "$line"
  #done < $logFile
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

#rabbitmqctl set_policy queue_consumer_timeout "with_delivery_timeout\.*" '{"consumer-timeout":3600000}' --apply-to classic_queues
#hh_recsys-task2

