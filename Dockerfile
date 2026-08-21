# syntax=docker/dockerfile:1

FROM maven:3.9-eclipse-temurin-21 AS backend-build
WORKDIR /workspace
COPY backend/pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn -q -DskipTests dependency:go-offline
COPY backend/src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -q -DskipTests package

FROM node:24-alpine AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY frontend/ .
ARG BACKEND_URL=http://127.0.0.1:8080
ENV BACKEND_URL=${BACKEND_URL}
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
RUN apk add --no-cache bash openjdk21-jre-headless
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV BACKEND_URL=http://127.0.0.1:8080

COPY --from=backend-build /workspace/target/karisanki-0.0.1-SNAPSHOT.jar /app/app.jar

WORKDIR /app/frontend
COPY --from=frontend-build /app/.next/standalone ./
COPY --from=frontend-build /app/.next/static ./.next/static
COPY --from=frontend-build /app/public ./public

COPY docker/entrypoint.sh /usr/local/bin/karisanki-entrypoint
RUN chmod +x /usr/local/bin/karisanki-entrypoint

EXPOSE 3000 8080
ENTRYPOINT ["/usr/local/bin/karisanki-entrypoint"]
