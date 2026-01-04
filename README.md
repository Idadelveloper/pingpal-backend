# PingPal Backend API

A high-performance, containerized Node.js backend for the PingPal location-sharing application. This API implements **Adaptive Caching Logic** using Redis and Google Kubernetes Engine (GKE) to optimize data retrieval speeds based on user network conditions (Wi-Fi vs. Cellular), aligning with the project's research methodology.

## Table of Contents

- [Architecture](#architecture)
- [Adaptive Caching Logic](#adaptive-caching-logic)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Environment Configuration](#environment-configuration)
- [Running Locally](#running-locally)
- [Deployment (GKE)](#deployment-google-kubernetes-engine)
- [API Documentation](#api-documentation)
  - [Update Location](#update-location)
  - [Get Ping Trail Locations](#get-ping-trail-locations)

---

## Architecture

This backend follows a microservices-based architecture deployed on **Google Kubernetes Engine (GKE)**:

- **API Service**: Node.js/Express server handling client requests.
- **Caching Layer**: Redis container running as a Pod in the cluster.
- **Database**: Firebase Firestore (managed externally) for persistent user/group data.
- **Orchestration**: Kubernetes handles scaling, networking, and secret management.

![Architecture Diagram](https://your-image-url-here-if-you-have-one)

## Adaptive Caching Logic

The core research innovation of this project is the dynamic **Time-To-Live (TTL)** assignment for cached location data:

| Network Type   | TTL (Seconds) | Rationale                                                         |
| :------------- | :------------ | :---------------------------------------------------------------- |
| **Wi-Fi / 5G** | `30s`         | High-speed connection; frequent updates allowed.                  |
| **4G**         | `60s`         | Standard stability; balanced update frequency.                    |
| **3G / 2G**    | `300s`        | Poor connection; long cache life to prevent data loss/flickering. |

---

## Tech Stack

- **Runtime**: Node.js (v18)
- **Framework**: Express.js
- **Cache**: Redis (Alpine)
- **Database**: Firebase Admin SDK
- **Deployment**: Docker & Kubernetes (GKE)

---

## Installation

### Prerequisites

- Node.js (v18+)
- Docker
- Google Cloud SDK (`gcloud`)
- `kubectl`

### 1. Clone the Repository

```bash
git clone [https://github.com/Idadelveloper/pingpal-backend.git](https://github.com/Idadelveloper/pingpal-backend.git)
cd pingpal-backend
```

### 2. Install Dependencies

```bash
npm install
```

## Environment Configuration

### 1. Firebase Credentials

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Navigate to Project Settings > Service Accounts.
3. Click Generate New Private Key.
4. Save the file as `serviceAccountKey.json` in the root of this project.

### 2. `.env` File

Create a `.env` file in the root directory:

```bash
PORT=3000
# For local development
REDIS_HOST=localhost
REDIS_PORT=6379
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
```

## Running Locally

### 1. Start Redis

You must have a Redis instance running locally. If you have Docker installed:

```bash
docker run --name redis-local -p 6379:6379 -d redis
```

### 2. Start the Server

```bash
npm start
```

- Server will run at: `http://localhost:3000`

## Deployment (Google Kubernetes Engine)

### 1. Build & Push Docker Image

Replace `YOUR_PROJECT_ID` with your actual Google Cloud Project ID.

```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/pingpal-backend .
```

### 2. Create Kubernetes Secrets

Securely upload your Firebase keys to the cluster.

```bash
kubectl create secret generic firebase-key \
    --from-file=serviceAccountKey.json=./serviceAccountKey.json
```

### 3. Deploy Redis & Backend

Apply the Kubernetes manifests.

```bash
kubectl apply -f redis.yaml
kubectl apply -f backend.yaml
```

### 4. Verify Deployment

Get the External IP address of your load balancer.

```bash
kubectl get services
```

Look for `pingpal-loadbalancer` under `EXTERNAL-IP`.

## API Documentation

### Update Location (Write Path)

Sends the user's current location to the Redis cache. The networkType field determines the cache expiration time (TTL).

- **Endpoint**: `POST /api/location/update`
- **Headers**: `Content-Type: application/json`

| Field         | Type     | Description                                          |
| :------------ | :------- | :--------------------------------------------------- |
| `userId`      | `string` | Unique ID of the user (from Firebase Auth).          |
| `latitude`    | `double` | Current latitude.                                    |
| `longitude`   | `double` | Current longitude.                                   |
| `networkType` | `string` | Network status: `'wifi'`, `'4g'`, `'3g'`, or `'5g'`. |

### Example Request

```json
{
  "userId": "user_123",
  "latitude": 51.5074,
  "longitude": 0.1278,
  "networkType": "wifi"
}
```

### Example Response

```json
{
  "status": "success",
  "ttl_applied": 30
}
```

### Get Ping Trail Locations (Read Path)

Retrieves the real-time locations of all participants in a specific "Ping Trail" (group session).

- **Endpoint**: `GET /api/location/trail/:trailId`
- **Params**: `trailId` - The Firestore document ID of the active trail.

### Example Response

```json
[
  {
    "userId": "user_123",
    "location": {
      "lat": 51.5074,
      "lng": 0.1278,
      "timestamp": 1709251200000
    }
  },
  {
    "userId": "user_456",
    "location": null // Indicates cache expired or user offline
  }
]
```
