FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /source
COPY global.json ./
COPY server/ server/
RUN dotnet publish server/src/Topout.Api/Topout.Api.csproj -c Release -o /out

FROM mcr.microsoft.com/dotnet/aspnet:10.0
USER root
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=app:app /out ./
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "Topout.Api.dll"]
