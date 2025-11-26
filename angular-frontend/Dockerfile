# ================================================
# 1) BUILD STAGE — Angular build using Node
# ================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (better cache)
COPY package.json ./

RUN npm install

# Copy full source
COPY . .

# Angular production build
RUN npm run build --if-present || npx ng build --configuration production


# ================================================
# 2) NGINX STAGE — serve static Angular build
# ================================================
FROM nginx:1.25-alpine

# Copy Angular build to nginx root
COPY --from=builder /app/dist/*/browser /usr/share/nginx/html

# Optional: Custom nginx config (recommended)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# SSL port (khai báo ý định - bỏ đi vẫn chạy)
EXPOSE 44301

CMD ["nginx", "-g", "daemon off;"]

