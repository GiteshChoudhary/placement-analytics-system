# College Placement Analytics System 🎓📊

A modern, full-stack campus recruitment and placement management web platform designed to streamline operations between students and Training & Placement Officers (TPOs). The platform facilitates student job applications with automated CGPA/backlog eligibility checks, secure PDF resume storage via AWS S3 presigned URLs, interactive data analytics with recruitment funnels and branch-wise placement metrics, and instant real-time status updates delivered directly to student dashboards using WebSocket-based Socket.io notifications.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite, React Router v7, Chart.js, react-chartjs-2, Socket.io-client, Axios, Vanilla CSS |
| **Backend** | Node.js, Express.js (HTTP + WebSocket server), Socket.io |
| **Database & ODM** | MongoDB, Mongoose |
| **Cloud Storage** | AWS S3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `multer-s3`) |
| **Authentication** | JSON Web Tokens (JWT), bcryptjs, Role-Based Access Control (Student / TPO) |

---

## ✨ Key Features

- **Role-Based Authentication (Student & TPO):**
  - Segmented registration and login flows.
  - Students register with academic credentials (Roll Number, Branch, CGPA, Backlogs).
  - TPOs register with administrative credentials without student-specific validation requirements.
  - Passwords securely hashed with bcrypt; state secured with stateless JWT tokens.

- **Automated Eligibility Engine & Application Tracking:**
  - Students browse active recruitment drives with detailed compensation packages and eligibility criteria.
  - Server-side criteria enforcement prevents unqualified applicants from applying (min CGPA, max backlogs).
  - Multi-stage recruitment tracking (`Eligibility` → `Aptitude` → `Technical` → `Offer` / `Rejected`) with visual step-by-step candidate progression bars.

- **Private & Secure Resume Management (AWS S3 Presigned URLs):**
  - PDF resumes uploaded directly to a private AWS S3 bucket.
  - Zero public bucket access — documents are served via temporary, cryptographically signed AWS presigned URLs valid for 5 minutes (`expiresIn: 300`).
  - Offloads heavy file transfer directly to AWS edge infrastructure while maintaining strict backend authorization.

- **Real-Time WebSockets Notifications (Socket.io):**
  - Persistent, bidirectional communication between backend and connected clients.
  - In-memory `studentId -> socket.id` mapping enables targeted unicasting: when a TPO advances a candidate's stage, an instant animated notification banner slides onto that student's dashboard and updates their table silently without a page refresh.

- **TPO Placement Analytics & Administration:**
  - **Funnel & Trend Visualizations:** Interactive Chart.js bar graphs showing branch-wise applicant distribution and company-by-company recruitment conversion funnels.
  - **Key Performance Indicators:** Instant overview metrics for Total Registered Students, Active Drives, Total Applications, Placement Rate (%), Average Package (LPA), and Highest Package (LPA).
  - **Placed Candidates Directory:** Filterable ledger of all candidates who have secured final job offers.
  - **Drive Management:** Form to register new participating companies and set criteria directly from the portal.

---

## 📁 Project Folder Structure

```text
placement_backend/
├── backend/
│   ├── config/
│   │   ├── db.js                 # MongoDB connection setup
│   │   └── s3Config.js           # AWS S3 client & presigned URL generator
│   ├── controllers/
│   │   ├── analyticsController.js# Aggregation pipelines for placement metrics
│   │   ├── applicationController.js# Application submission & stage transitions
│   │   ├── authController.js     # User registration & authentication
│   │   ├── companyController.js  # Company drive management
│   │   └── studentController.js  # Student profile & resume operations
│   ├── middleware/
│   │   ├── authMiddleware.js     # JWT verification & RBAC authorization
│   │   └── uploadMiddleware.js   # Multer-S3 file upload pipeline
│   ├── models/
│   │   ├── Application.js        # Application schema with stage history
│   │   ├── Company.js            # Company drive & eligibility criteria schema
│   │   └── Student.js            # User model with conditional validation
│   ├── routes/
│   │   ├── analyticsRoutes.js    # TPO analytics endpoints
│   │   ├── applicationRoutes.js  # Candidate application routes
│   │   ├── authRoutes.js         # Authentication endpoints
│   │   ├── companyRoutes.js      # Recruitment drive routes
│   │   └── studentRoutes.js      # Student profile & resume routes
│   ├── .env.example              # Sample environment variables
│   ├── package.json              # Backend dependencies & scripts
│   └── server.js                 # HTTP & Socket.io server entry point
│
└── placement-frontend/
    ├── src/
    │   ├── api/
    │   │   └── axios.js          # Preconfigured Axios instance with auth interceptor
    │   ├── context/
    │   │   └── AuthContext.jsx   # Global user session & authentication provider
    │   ├── pages/
    │   │   ├── Auth.css          # Styling for Login & Register forms
    │   │   ├── Login.jsx         # Sign-in page with role toggle
    │   │   ├── Register.jsx      # Sign-up page with role-specific field toggle
    │   │   ├── StudentDashboard.css # Student portal & resume styling
    │   │   ├── StudentDashboard.jsx # Student portal (drives, applications, resume)
    │   │   ├── TPODashboard.css  # Admin analytics & applications styling
    │   │   └── TPODashboard.jsx  # TPO portal (analytics, stage update, add drive)
    │   ├── App.jsx               # Route definitions & protected route wrappers
    │   └── main.jsx              # React DOM initialization
    ├── index.html                # HTML entry point
    ├── package.json              # Frontend dependencies
    └── vite.config.js            # Vite build configuration
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [MongoDB](https://www.mongodb.com/) (Local instance or MongoDB Atlas connection string)
- [AWS Account](https://aws.amazon.com/) with an S3 bucket and IAM user credentials (`s3:PutObject`, `s3:GetObject`)

---

### 1. Backend Setup

1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install backend dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Create a `.env` file in the `backend/` folder based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

   Fill in the required variables:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key

   # AWS S3 Storage
   AWS_ACCESS_KEY_ID=your_aws_access_key_id
   AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
   AWS_REGION=your_aws_bucket_region
   AWS_BUCKET_NAME=your_s3_bucket_name
   ```

4. Start the backend development server:
   ```bash
   npm run dev
   # or
   node server.js
   ```
   *The backend will be available at `http://localhost:5000`.*

---

### 2. Frontend Setup

1. Open a second terminal and navigate to the frontend directory:
   ```bash
   cd placement-frontend
   ```

2. Install frontend dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The frontend will launch at `http://localhost:5173`.*

---

## 📡 API Endpoints Summary

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register a new Student or TPO user | Public |
| `POST` | `/api/auth/login` | Authenticate credentials and return JWT token | Public |

### Companies / Drives (`/api/companies`)
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/companies` | List all active recruitment drives | Public / Student |
| `POST` | `/api/companies` | Register a new recruitment company with eligibility criteria | Public / TPO |

### Applications (`/api/applications`)
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/applications` | Submit application with criteria validation | Private (Student) |
| `GET` | `/api/applications/my` | Retrieve logged-in student's applications | Private (Student) |
| `GET` | `/api/applications` | Retrieve all applications across all drives | Private (TPO) |
| `PUT` | `/api/applications/:id/stage` | Update candidate interview stage & emit live socket update | Private (TPO) |

### Student Profile & Resume (`/api/students`)
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/students/me` | Fetch authenticated student profile | Private (Student) |
| `POST` | `/api/students/upload-resume` | Upload PDF resume to private S3 bucket | Private (Student) |
| `GET` | `/api/students/resume-url` | Generate temporary 5-min presigned URL for own resume | Private (Student) |
| `GET` | `/api/students/:id/resume-url` | Generate temporary 5-min presigned URL for student resume | Private (TPO) |

### Analytics (`/api/analytics`)
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/analytics/overview` | Overall metrics (students, offers, placement rate) | Private (TPO) |
| `GET` | `/api/analytics/branch-wise` | Branch-wise applications vs. offers breakdown | Private (TPO) |
| `GET` | `/api/analytics/company-wise` | Company recruitment funnel breakdown | Private (TPO) |
| `GET` | `/api/analytics/average-package` | Average, highest, and lowest package metrics | Private (TPO) |
| `GET` | `/api/analytics/placed-students` | Detailed directory of students with confirmed offers | Private (TPO) |

---

## 🔮 Future Improvements

- **Automated Email Notifications:** Integrate Nodemailer or AWS SES to dispatch transactional confirmation emails when a student secures an interview offer or when a new drive is announced.
- **Server-Side Pagination & Sorting:** Implement cursor/skip-based pagination on large datasets (e.g., thousands of student applications) for optimized database query performance.
- **Bulk CSV / Excel Export:** Allow TPO officers to export placed candidate lists, eligible student rosters, and analytics reports directly as downloadable `.xlsx` or `.csv` files.
- **Resume Parsing with AI:** Automatically parse uploaded PDF resumes using OCR and NLP to extract technical skill tags, projects, and keywords for smarter matching against job requirements.
- **Interview Scheduling Module:** Enable TPO officers and recruiters to schedule specific interview time slots and send calendar invitations (`.ics`) to shortlisted candidates.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
