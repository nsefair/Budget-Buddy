FROM --platform=$BUILDPLATFORM golang:1.26.6-alpine AS build
ARG TARGETOS
ARG TARGETARCH

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY cmd ./cmd
COPY internal ./internal

RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o /out/budget-buddy-api ./cmd/api

FROM alpine:3.23

RUN addgroup -S app && adduser -S app -G app \
    && mkdir -p /var/lib/budget-buddy/media \
    && chown -R app:app /var/lib/budget-buddy
USER app

COPY --from=build /out/budget-buddy-api /usr/local/bin/budget-buddy-api

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/budget-buddy-api"]
