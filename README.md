# planmaterias

Visual career planner built with **Next.js + ReactFlow + Supabase** to
manage and visualize a university curriculum as an interactive graph.

------------------------------------------------------------------------

## ✨ Overview

**planmaterias** is a personal web application designed to visualize a
full academic curriculum as a graph-based map.\
Each subject appears as a node with status tracking, prerequisites,
grades and a mini file repository.

The goal is to provide a clear visual progression through a career plan
while keeping personal academic resources organized.

------------------------------------------------------------------------

## 🎯 Main Features

### 🧭 Interactive Career Map

-   Graph visualization powered by **ReactFlow**
-   Years displayed as horizontal rows
-   Grid layout per year (3 columns)
-   Dynamic spacing to prevent overlap
-   Header nodes for each year

### 🎓 Academic Status System

Each subject can have one of four states:

-   `pendiente`
-   `cursando`
-   `final_pendiente`
-   `aprobada`

Derived visual state:

-   `disponible` → subject becomes available when all prerequisites are
    approved.

### 📝 Grades

-   Grade range: **1 to 10**
-   Supports **0.25 increments**
-   Approval method:
    -   promo
    -   final

### 🔗 Prerequisites Logic

-   Stored in `subject_prereq`
-   Currently only `rendir` prerequisites are used
-   A subject becomes available when all required subjects are approved.

### 📎 Mini Repository per Subject

Integrated file storage using Supabase:

-   Upload files
-   Signed URL access
-   Delete files
-   File types:
    -   apunte
    -   tp
    -   otro

### 🔐 Lightweight Security

-   Simple password gate
-   Next.js middleware protection
-   No full authentication (personal project)

------------------------------------------------------------------------

## 🧱 Tech Stack

-   **Next.js (App Router)**
-   **ReactFlow**
-   **Supabase**
    -   PostgreSQL
    -   Storage Buckets
-   TypeScript

------------------------------------------------------------------------

## 🚀 Local Development

Install dependencies:

``` bash
npm install
```

Run dev server:

``` bash
npm run dev
```

Open:

http://localhost:3000

------------------------------------------------------------------------

## 🔐 Environment Variables

Create a `.env.local` file:

``` env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
APP_PASSWORD=
APP_PASSWORD_COOKIE=
```

------------------------------------------------------------------------

## 🗺️ Layout Details

-   Horizontal year layout
-   Dynamic block height calculation:
    -   rowsNeeded = ceil(count / COLS_PER_YEAR)
    -   blockHeight computed per year
-   ReactFlow custom nodes for subjects

------------------------------------------------------------------------

## 📦 Database Structure (Simplified)

### subjects

-   id
-   name
-   year
-   order_in_cell

### subject_prereq

-   subject_id
-   prereq_subject_id
-   prereq_type

### user_subject_status

-   subject_id
-   status
-   grade
-   passed_via
-   approved_at

### subject_files

-   id
-   subject_id
-   title
-   file_type
-   storage_path

------------------------------------------------------------------------

## 📎 Storage

Bucket:

planmaterias-files

Files stored using path pattern:

subjectId/timestamp-filename

------------------------------------------------------------------------

## ⚠️ Notes

This project is intended for **personal use**.

-   Uses anon Supabase key
-   RLS policies allow personal workflow
-   Security may be hardened later with server routes

------------------------------------------------------------------------

## 🧭 Future Improvements

-   File count badge on nodes
-   Smarter zoom & viewport UX
-   Server-side upload routes
-   Vercel deployment

------------------------------------------------------------------------

## 👨‍💻 Author

Personal project created to experiment with graph-based academic
planning using modern web technologies.
