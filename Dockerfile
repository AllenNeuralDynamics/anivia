FROM python:3.8-slim

WORKDIR /app

COPY . .

RUN apt-get update

EXPOSE 8000

ENTRYPOINT ["python", "-m", "http.server", "8000", "--directory", "src"]
