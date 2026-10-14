# Gunakan Node.js LTS Alpine yang ringan dan cepat
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV ADMIN_USER=admin
ENV ADMIN_PASS=admin123

# Salin package.json
COPY package.json ./

# Salin source code aplikasi
COPY server.js ./
COPY public/ ./public/
COPY data/ ./data/

# Port yang diexpose
EXPOSE 3000

# Volume untuk persistensi data (skor, riwayat, dan upload background)
VOLUME ["/app/data"]

# Perintah menjalankan server
CMD ["node", "server.js"]
