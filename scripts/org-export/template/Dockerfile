FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV FREEOS_UPSTREAM=http://127.0.0.1:8088
ENV NGINX_ENVSUBST_FILTER=FREEOS_UPSTREAM
EXPOSE 80
