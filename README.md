# KiranaBook Backend

GraphQL API for kirana (grocery) stores: products and stock, customers, billing, khata (credit ledger) and a daily dashboard.

**Stack:** Node.js 20, Apollo Server (GraphQL) on Express, MongoDB (Mongoose), Redis (ioredis), Docker, and GitHub Actions.

## Features

- **Auth:** shop owners register and log in with a JWT. Every record is scoped to its owner, so many shops can share one deployment.
- **Products:** CRUD, categories, SKU and barcode lookup, low-stock alerts, stock adjustments. Delete is a soft delete.
- **Customers & khata:** credit (`CREDIT`) bills add to the customer's balance. `recordPayment` reduces it. Every change is written to a ledger.
- **Billing:** `createOrder` checks stock and decrements it atomically (rolling back on failure), numbers bills per shop, and applies discounts. `cancelOrder` restores stock and reverses khata credit.
- **Dashboard:** today's sales, order count, low-stock count and total credit due.
- **Redis:** caches product lists, categories and the dashboard, and invalidates them on writes. It also rate-limits logins. If Redis is down the API still works, just without the cache.

## Project structure

```
src/
  config/        env, MongoDB and Redis connections
  models/        User, Product, Customer, Order, KhataEntry, Counter
  graphql/       typeDefs, resolvers (auth, product, customer, order, dashboard)
  utils/         auth (JWT), cache (Redis), helpers
  index.js       Express + Apollo server, /health endpoint
test/            schema smoke tests (node --test)
.github/workflows/ci-cd.yml
Dockerfile, docker-compose.yml
```

## Run locally

You need Node 20+, plus MongoDB and Redis running on your machine.

```bash
cp .env.example .env          # then set JWT_SECRET
npm install
npm run dev                   # http://localhost:4000/graphql (Apollo Sandbox in the browser)
npm test
```

`MONGO_URI` defaults to `mongodb://127.0.0.1:27017/kiranabook` (local MongoDB).

### Run with Docker locally

Compose runs the API and Redis. MongoDB stays on the host:

```bash
# in .env
MONGO_URI=mongodb://host.docker.internal:27017/kiranabook
docker compose up -d --build
curl localhost:4000/health
```

> MongoDB must accept connections from Docker. In `/etc/mongod.conf` set
> `net.bindIp: 127.0.0.1,172.17.0.1` (the docker0 gateway), then run `sudo systemctl restart mongod`.
> Don't expose port 27017 to the internet; block it with your firewall.

## Example GraphQL

```graphql
mutation {
  register(input: { name: "Ramesh", email: "ramesh@shop.com", password: "secret123", shopName: "Ramesh Kirana" }) {
    token
  }
}
```

Send the token as `Authorization: Bearer <token>` on all other requests:

```graphql
mutation { createProduct(input: { name: "Toor Dal", sku: "DAL1", category: "Pulses", unit: KG, price: 140, stock: 50 }) { id } }
mutation { createCustomer(input: { name: "Suresh", phone: "9876543210" }) { id } }
mutation {
  createOrder(input: {
    customerId: "<customerId>", paymentMode: CREDIT, discount: 10,
    items: [{ productId: "<productId>", quantity: 2 }]
  }) { billNumber total customer { balance } }
}
mutation { recordPayment(customerId: "<customerId>", amount: 100, note: "cash") { balance } }
query { dashboard { todaySales todayOrders lowStockCount totalCreditDue } }
query { products(lowStock: true) { total items { name stock } } }
```

## CI/CD (GitHub Actions)

The workflow is `.github/workflows/ci-cd.yml`:

1. **test:** runs `npm ci` and `npm test` on every push and PR to `main`.
2. **build:** builds the Docker image and pushes it to GitHub Container Registry as `ghcr.io/<owner>/<repo>:<sha>` and `:latest`. It logs in with the built-in `GITHUB_TOKEN`.
3. **deploy:** connects to the server over SSH, copies `docker-compose.yml`, writes `.env` from secrets, pulls the new image, runs `docker compose up -d`, and checks `/health`.

### 1. Prepare the server (one time)

```bash
# On the server: Docker + compose plugin, MongoDB (local), curl
sudo apt-get install -y curl
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER          # log out and back in
mkdir -p ~/kiranabook
# Install MongoDB, then set net.bindIp: 127.0.0.1,172.17.0.1 (see note above)
```

Create a deploy key pair and authorise it on the server:

```bash
ssh-keygen -t ed25519 -C "github-actions-kiranabook" -f ~/.ssh/kiranabook_deploy -N ""
ssh-copy-id -i ~/.ssh/kiranabook_deploy.pub <user>@<server>
```

### 2. Add GitHub secrets

In the repo, go to **Settings → Secrets and variables → Actions → New repository secret**. The workflow runs in the `production` environment, so you can also store the secrets there.

| Secret            | Required | Example                                          |
|-------------------|----------|--------------------------------------------------|
| `SSH_HOST`        | yes      | `203.0.113.10`                                   |
| `SSH_USER`        | yes      | `ubuntu`                                         |
| `SSH_PRIVATE_KEY` | yes      | contents of `~/.ssh/kiranabook_deploy`           |
| `SSH_PORT`        | no       | `22` (default)                                   |
| `DEPLOY_PATH`     | yes      | `/home/ubuntu/kiranabook` (absolute path)        |
| `MONGO_URI`       | yes      | `mongodb://host.docker.internal:27017/kiranabook`|
| `JWT_SECRET`      | yes      | long random string                               |
| `APP_PORT`        | no       | `4000` (default)                                 |
| `CORS_ORIGIN`     | no       | `*` (default) or `https://your-frontend.com`     |

You can also set them all with the GitHub CLI:

```bash
cp .env.deploy.example .env.deploy     # fill in real values (git-ignored)
gh secret set -f .env.deploy
gh secret set SSH_PRIVATE_KEY < ~/.ssh/kiranabook_deploy
```

### 3. Push

```bash
git init && git add . && git commit -m "Initial KiranaBook backend"
git branch -M main
git remote add origin git@github.com:<you>/<repo>.git
git push -u origin main
```

Each push to `main` now tests, builds and deploys.
