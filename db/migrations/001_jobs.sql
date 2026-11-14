-- Staff jobs and the reports filed against them.
-- Photos and PDFs stay in Google Drive. This database stores the job and the Drive link.

CREATE SEQUENCE IF NOT EXISTS job_number_seq START WITH 1001;

CREATE TABLE IF NOT EXISTS jobs (
  id text PRIMARY KEY,
  company text NOT NULL CHECK (company IN ('emoro', 'emporo')),
  job_number integer NOT NULL UNIQUE,
  client_name text NOT NULL,
  phone text,
  email text,
  address text NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'complete')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jobs_client_address ON jobs (lower(client_name), lower(address));

CREATE TABLE IF NOT EXISTS job_reports (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES jobs (id),
  form_type text NOT NULL,
  drive_file_id text NOT NULL,
  drive_url text NOT NULL,
  answers text NOT NULL,
  submitted_by text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_reports_lookup ON job_reports (job_id, form_type, submitted_at DESC);
