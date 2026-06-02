FROM golang:1.25-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY cmd ./cmd
COPY internal ./internal

RUN CGO_ENABLED=0 GOOS=linux go build -o /out/budget-buddy-api ./cmd/api

FROM alpine:3.20

RUN addgroup -S app && adduser -S app -G app
USER app

COPY --from=build /out/budget-buddy-api /usr/local/bin/budget-buddy-api

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/budget-buddy-api"]
