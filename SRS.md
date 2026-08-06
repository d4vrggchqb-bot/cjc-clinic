# System Requirements Specification (SRS)
## for CJC Clinic Management System

**Version:** 1.0
**Date:** August 2026

---

## 1. Introduction

### 1.1 Purpose
The purpose of this document is to define the system requirements for the **CJC Clinic Management System**. It outlines the functional and non-functional requirements, external interfaces, and constraints of the system. This document serves as a guide for developers, system administrators, and clinic stakeholders.

### 1.2 Intended Audience
This document is intended for:
- **Developers & Engineers:** To understand the required features and backend structure.
- **Clinic Staff (Doctors, Nurses, Clerks):** To verify that the system meets their daily operational workflows.
- **School Administrators:** To understand the scope and capabilities of the clinic system.

### 1.3 Product Scope
The CJC Clinic Management System is a web-based, minimal clinic management application designed to digitize and streamline operations across multiple school branches (College Clinic, BED Clinic, Power Campus Clinic). The system provides tools to manage patient profiles (students and employees), record daily medical consultations, track inventory (medicines, supplies, equipment), handle medical certificates, process purchase requests, schedule appointments, and manage borrowed items.

---

## 2. Overall Description

### 2.1 Product Perspective
The system is an independent, client-server web application. It consists of:
- **Frontend:** Built with TypeScript and CSS, providing a responsive and interactive user interface.
- **Backend:** A RESTful API built with PHP to handle business logic.
- **Database:** A relational MySQL/MariaDB database (`cjc_clinic`) to ensure data integrity and storage.

### 2.2 User Classes and Characteristics
The system defines several user roles with varying levels of access:
- **System Administrator / Superadmin:** Has full access to the system. Can manage users, configure settings, and oversee all branches.
- **Doctor / Nurse:** Medical professionals who conduct consultations, record vital signs, input diagnoses, prescribe treatments, and issue medical certificates.
- **Staff / Clerk:** Front-desk personnel responsible for adding patient profiles, managing appointments, handling basic inventory dispensing, and tracking borrowed items.

### 2.3 Operating Environment
- **Server:** Web server capable of running PHP 8+ and MySQL/MariaDB.
- **Client:** Modern web browsers (Chrome, Firefox, Safari, Edge) on desktop or tablet devices.
- **Network:** Requires intranet or internet connectivity to communicate between the frontend and the PHP backend.

---

## 3. Functional Requirements

### 3.1 User Management & Authentication
- **REQ-1.1:** The system shall allow users to log in using a unique username and password.
- **REQ-1.2:** The system shall securely hash all passwords using the bcrypt algorithm.
- **REQ-1.3:** The system shall enforce role-based access control (RBAC) to restrict access to sensitive modules based on the user's role (Admin, Doctor, Nurse, Staff, Clerk).

### 3.2 Patient Profile Management
- **REQ-2.1:** The system shall allow staff to create and maintain profiles for both students and employees.
- **REQ-2.2:** The system shall store essential patient data, including ID number, course/department, contact details, emergency contacts, and vital statistics.
- **REQ-2.3:** The system shall support the uploading and viewing of document attachments (e.g., medical records, lab results) linked to a patient's profile.

### 3.3 Consultation Module
- **REQ-3.1:** Medical staff shall be able to create consultation records for patients.
- **REQ-3.2:** The system shall capture consultation details including purpose, physical complaints, vital signs (BP, temperature, weight), diagnosis, and treatment.
- **REQ-3.3:** The system shall track the real-time status of a consultation (e.g., waiting, active, in-progress, completed).
- **REQ-3.4:** The system shall allow medical staff to write notes and prescriptions within the consultation record.

### 3.4 Inventory Management
- **REQ-4.1:** The system shall maintain a catalog of inventory items categorized by medicine, supply, or equipment.
- **REQ-4.2:** The system shall track physical batches of inventory per clinic branch, including batch numbers, arrival dates, remaining stock, and expiration dates.
- **REQ-4.3:** The system shall automatically flag items that fall below a predefined alert threshold (e.g., 20 units).
- **REQ-4.4:** The system shall maintain an immutable log of all inventory transactions (restocking, dispensing, disposing, and adjustments).

### 3.5 Purchase Requests
- **REQ-5.1:** Users shall be able to generate purchase requests for low-stock items.
- **REQ-5.2:** The system shall track the status of purchase requests (pending, approved, delivered, cancelled) and record expected vs. actual delivery dates.

### 3.6 Medical Certificates
- **REQ-6.1:** Authorized medical staff shall be able to generate and issue medical certificates for patients.
- **REQ-6.2:** The system shall record the reason for issuance and the validity period (valid until date) of the certificate.

### 3.7 Appointment Scheduling
- **REQ-7.1:** The system shall allow users to schedule appointments for patients on specific dates and times.
- **REQ-7.2:** The system shall track the status of appointments (Scheduled, Completed, Cancelled, No-Show).

### 3.8 Borrowing System
- **REQ-8.1:** The system shall allow tracking of clinic equipment and supplies borrowed by patients.
- **REQ-8.2:** The system shall update the status of borrowings from pending, to active, to returned, and log the return date.

---

## 4. External Interface Requirements

### 4.1 User Interfaces
- The user interface shall be built using modern web standards (HTML5, CSS, TypeScript).
- The interface shall be responsive, ensuring usability on standard desktop monitors and tablet devices used in clinic settings.

### 4.2 Software Interfaces
- **Database:** The system shall interface with a MySQL database via PDO or MySQLi in PHP.
- **API:** The frontend shall communicate with the backend using standard HTTP/REST protocols, sending and receiving JSON payloads.

---

## 5. Non-Functional Requirements

### 5.1 Security & Privacy
- All API endpoints handling patient health data must require authentication.
- Patient health records and histories shall only be visible to authorized medical staff and administrators.
- The system must prevent SQL injection through the use of prepared statements (as supported by the chosen PHP database driver).

### 5.2 Reliability & Data Integrity
- The database shall enforce referential integrity using foreign keys and `ON DELETE CASCADE` / `ON DELETE SET NULL` constraints to prevent orphaned records (e.g., deleting a profile automatically cleans up associated consultations).

### 5.3 Maintainability
- The backend architecture should clearly separate entry points (`public/`) from configuration (`config/`) and business logic to allow for easy future updates.
