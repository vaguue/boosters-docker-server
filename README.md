## Docker Server Overview

1. Создаем консюмер
2. Получаем задачи
3. Пришла задача, скачиваем .zip архив из ссылки в объекте
4. Запускаем на тестовых данных (child_process.exec(dockerCmd))
5. Запускаем на реальных данныех
6. Пушим в другую очередь результат

```
|API| <--> (|RabbitMQ| <--> |Docker Server|)
        task: task2, task3
        result: result1

      
|API| <--> (|RabbitMQ| <--> |Docker Server|)
              ^^^^^^
              ||||||
              |Docker Server|
                |Docker Server|
                  |Docker Server|
                    |Docker Server|
                      |Docker Server|
```


## Развертывание Docker Server
### Заполнение папок, пример
TEST_DATASET_DIR=/home/user/champdata/test
FINAL_DATASET_DIR=/home/user/champdata/pub
В каждую положить данные из задачи, индексы для метрик итд
и сделать `mkdir -p /home/user/workers/worker0` (и для других воркеров, worker1, worker2 итд)

### Содержимое .env (посмотреть .env в репозитории):

MAIN_SERVER_IP, 
TEST_DATASET_DIR, 
FINAL_DATASET_DIR, 
CHAMPNAME, 
TIME_LIMIT
MAIN_SERVER_DOCKER_ACCESS, 
MAIN_SERVER_SECRET_KEY

### Если таймлимит выше 30 мин:

```bash
docker exec -it rabbitmq bash
rabbitmqctl eval 'application:set_env(rabbit, consumer_timeout, 21600000).'
```

## Задачи
1. Сделать ЦПУ сервак с брокером RabbitMQ (./rabbitmq.sh)
2. Развернуть тестово докер-сервер (`npm i && npm start` после создания актуального .env)
3*. Сделать правки на API для поддержки требования 1 команда: 1 ГПУ
4. Развернуть 15 докер-серверов

## Пример запуска
```bash
MY_ID=0 pm2 start ecosystem.config.js 
```
