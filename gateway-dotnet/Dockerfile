# ============================
# 1. BUILD STAGE
# ============================
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy project files
COPY *.csproj ./
RUN dotnet restore

# Copy everything else and publish
COPY . .
RUN dotnet publish -c Release -o /app


# ============================
# 2. RUNTIME STAGE
# ============================
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

# Copy compiled output
COPY --from=build /app .

# EXPOSE ports
EXPOSE 5000

# For WebSocket support (ASP.NET automatically supports WS)
ENV ASPNETCORE_URLS=http://0.0.0.0:5000

# Copy Ocelot configs
COPY ocelot.docker.json .

# ============================
# ENTRYPOINT
# ============================
ENTRYPOINT ["dotnet", "Gateway.dll"]
