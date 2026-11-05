# Build stage
FROM docker.io/library/golang:1.27.3-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -o orpheus ./cmd/server

# Runtime stage
FROM docker.io/library/alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /app/orpheus .
COPY migrations ./migrations
RUN mkdir -p /app/data
EXPOSE 8080
ENTRYPOINT ["./orpheus"]
