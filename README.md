# PlanMaterias

Web app para armar y seguir tu carrera: materias por año/período,
correlativas, estados (pendiente/cursando/final/aprobada), flechas de
correlativas en la vista Timeline y mini-repo de archivos por materia
(Supabase Storage).

## Stack

-   Next.js (App Router) + TypeScript
-   Supabase (Auth + Postgres + Storage)
-   UI modo dark

## Features (MVP actual)

-   Login con Supabase
-   Un plan/carrera por usuario (owner)
-   ABM de materias por plan
-   ABM de correlativas (rendir/cursar)
-   Timeline con:
    -   Cards por año
    -   Flechas punteadas animadas entre correlativas
    -   Panel lateral para editar estado
-   Mini repo por usuario y materia:
    -   Subida/descarga/borrado de archivos
    -   Storage path: userId/subjectId/...

## Variables de entorno

Crear `.env.local` en la raíz:

NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=...

## Setup

Instalar dependencias:

npm install

Correr en desarrollo:

npm run dev

Build producción:

npm run build npm run start

## Modelo de datos (resumen)

### plans

-   id (uuid)
-   owner_id (uuid)
-   name (text)
-   mode (annual \| periodic)
-   years_count (int)
-   periods (text)
-   created_at

### subjects

-   id (uuid)
-   plan_id (uuid)
-   name (text)
-   year (int)
-   period_key (text)
-   order_in_cell (int)

### subject_prereq

-   subject_id (uuid)
-   prereq_subject_id (uuid)
-   prereq_type (rendir \| cursar)

### user_subject_status

-   user_id (uuid)
-   subject_id (uuid)
-   status (pendiente \| cursando \| final_pendiente \| aprobada)
-   grade (numeric)
-   passed_via (promo \| final)

(Recomendado: unique user_id + subject_id)

### subject_files

-   id (uuid)
-   user_id (uuid)
-   subject_id (uuid)
-   title (text)
-   file_type (apunte \| tp \| otro)
-   storage_path (text)

## Roadmap

-   RLS completo en tablas y storage
-   Upsert por (user_id, subject_id)
-   Import por lista/CSV
-   Mejoras UI (buscadores, nodos full color)

------------------------------------------------------------------------

Proyecto en progreso.
