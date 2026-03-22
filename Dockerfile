FROM alpine:3.21

ARG PB_VERSION=0.36.6

RUN apk add --no-cache ca-certificates wget unzip \
    && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" -O /tmp/pocketbase.zip \
    && unzip /tmp/pocketbase.zip -d /opt/pocketbase \
    && rm /tmp/pocketbase.zip \
    && chmod +x /opt/pocketbase/pocketbase

COPY pb_hooks/ /opt/pocketbase/pb_hooks/

EXPOSE 8090

VOLUME /opt/pocketbase/pb_data

WORKDIR /opt/pocketbase

CMD ["./pocketbase", "serve", "--http=0.0.0.0:8090"]
