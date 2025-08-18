# Shopinkeys

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/mongodb-%3E%3D5.0-green)](https://www.mongodb.com/)

Shopinkeys is a cutting-edge **Amazon Affiliate and wellness technology platform** that helps users integrate technology into their fitness and wellness journeys. The platform offers product reviews, comparisons, insights, health tips, and trending tech updates.

## Features

### User-Facing
- **Browse products**: Amazon Affiliate integration for wellness tech products.  
- **Full reviews & blog posts**: Detailed insights and comparisons.  
- **Community engagement**: Commenting, liking, and discussions.  
- **User roles**:
  - Random Users (guests) can browse, like, and comment.  
  - Registered Users, Editors, Collaborators, and Admins for enhanced content management.  
- **Authentication & Security**:
  - JWT-based authentication.  
  - Email verification & password reset flows.  
  - Role-Based Access Control (RBAC).

### Admin & Content Management
- WordPress-like backend for content creation & management.  
- Media uploads for product images and user-generated content.  
- Manage user roles, permissions, and posts.  
- Integrated monetization options: Google AdSense & Amazon/TEMU affiliate links.

### Technical Highlights
- **Stack**: MERN (MongoDB, Express.js, React.js, Node.js) with TypeScript for type safety.  
- **SEO optimized**: Dynamic content rendering with React for SEO-friendly pages.  
- **Testing**: Jest unit and integration tests for backend reliability.  
- **Deployment Ready**: Dockerized and ready for AWS/Render deployment.  
- **Localization**: Multi-language support via i18next.

## Installation

```bash
# Clone repository
git clone https://github.com/yourusername/shopinkeys-backend-api.git
cd shopinkeys-backend-api

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
````

## Running Locally

```bash
# Start development server
npm run dev

# Run tests
npm run test
```

Access the server at `http://localhost:4000`.

## Environment Variables

Create a `.env` file with:

```
PORT=4000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
EMAIL_SERVICE_API_KEY=your_email_service_key
```

## API Endpoints

* **Authentication**

  * `POST /api/auth/register` – Register a new user
  * `POST /api/auth/login` – Login and get JWT
  * `POST /api/auth/logout` – Logout
  * `POST /api/auth/forgot-password` – Request password reset
  * `POST /api/auth/reset-password/:token` – Reset password
  * `GET /api/auth/verify-email/:token` – Verify email

* **Roles & Permissions**

  * Admin-only routes to manage users, roles, and content.

* **Products & Blog**

  * `GET /api/products` – List products
  * `GET /api/posts` – List blog posts

## Contribution

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a feature branch: `git checkout -b feat/my-feature`.
3. Commit your changes: `git commit -m "Add my feature"`.
4. Push: `git push origin feat/my-feature`.
5. Open a Pull Request.

## License

This project is licensed under the MIT License.

## Contact

Developed and maintained by **Light Ikoyo** – [LinkedIn](https://www.linkedin.com/in/light-ikoyo) | [Email](mailto:eseogheneikoyo23@gmail.com)

---

Elevate your wellness tech journey with Shopinkeys 

```

