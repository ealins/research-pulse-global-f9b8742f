-- Seed institutions for GeoAcademic production database
-- Run this in Supabase SQL Editor: https://supabase.com/projects/rqalvagtdcqurubrsdnc

-- Insert core geospatial institutions
INSERT INTO institutions (name, official_url, research_url, careers_url, country_code, region, created_at, updated_at)
VALUES 
  ('ISPRS - International Society for Photogrammetry and Remote Sensing',
   'https://www.isprs.org',
   'https://www.isprs.org/job_opportunities/default.aspx',
   'https://www.isprs.org/calendar/2026.aspx',
   'AT', 'Europe', now(), now()),
  
  ('EGU - European Geosciences Union',
   'https://www.egu.eu',
   'https://www.egu.eu/g/jobs/',
   'https://www.egu.eu/g/events/',
   'AT', 'Europe', now(), now()),
  
  ('Earth Observations International',
   'https://earthobservations.org',
   'https://earthobservations.org/about-us/events',
   'https://earthobservations.org',
   'CH', 'Europe', now(), now()),
  
  ('MIT Earth, Atmospheric and Planetary Sciences',
   'https://eaps.mit.edu',
   'https://eaps.mit.edu/research',
   'https://eaps.mit.edu/careers',
   'US', 'North America', now(), now()),
  
  ('Stanford School of Earth, Energy & Environmental Sciences',
   'https://earth.stanford.edu',
   'https://earth.stanford.edu/research',
   'https://earth.stanford.edu/careers',
   'US', 'North America', now(), now()),
  
  ('UC Berkeley Earth and Planetary Science',
   'https://eps.berkeley.edu',
   'https://eps.berkeley.edu/research',
   'https://eps.berkeley.edu/opportunities',
   'US', 'North America', now(), now()),
  
  ('University of Oxford Department of Earth Sciences',
   'https://www.earth.ox.ac.uk',
   'https://www.earth.ox.ac.uk/research',
   'https://www.ox.ac.uk/jobs',
   'GB', 'Europe', now(), now()),
  
  ('ETH Zurich Department of Earth Sciences',
   'https://erdw.ethz.ch',
   'https://erdw.ethz.ch/en/research.html',
   'https://jobs.ethz.ch',
   'CH', 'Europe', now(), now()),
  
  ('University of Tokyo Department of Earth and Planetary Science',
   'https://www.eps.s.u-tokyo.ac.jp',
   'https://www.eps.s.u-tokyo.ac.jp/en/research',
   'https://www.u-tokyo.ac.jp/en/jobs/',
   'JP', 'Asia', now(), now()),
  
  ('CNES - Centre National d''Études Spatiales',
   'https://cnes.fr',
   'https://cnes.fr/en/research',
   'https://cnes.fr/en/careers',
   'FR', 'Europe', now(), now()),
   
  ('NASA Goddard Space Flight Center',
   'https://www.nasa.gov/goddard',
   'https://www.nasa.gov/goddard/research',
   'https://www.nasa.gov/careers',
   'US', 'North America', now(), now()),
   
  ('European Space Agency (ESA)',
   'https://www.esa.int',
   'https://www.esa.int/Science_Exploration',
   'https://www.esa.int/About_Us/Careers_at_ESA',
   'FR', 'Europe', now(), now()),
   
  ('USGS - US Geological Survey',
   'https://www.usgs.gov',
   'https://www.usgs.gov/programs',
   'https://www.usgs.gov/about/careers',
   'US', 'North America', now(), now()),
   
  ('British Geological Survey',
   'https://www.bgs.ac.uk',
   'https://www.bgs.ac.uk/research/',
   'https://www.bgs.ac.uk/jobs/',
   'GB', 'Europe', now(), now()),
   
  ('University of Cambridge Department of Earth Sciences',
   'https://www.esc.cam.ac.uk',
   'https://www.esc.cam.ac.uk/research',
   'https://www.jobs.cam.ac.uk',
   'GB', 'Europe', now(), now())
ON CONFLICT (official_url) DO UPDATE 
SET 
  research_url = EXCLUDED.research_url,
  careers_url = EXCLUDED.careers_url,
  updated_at = now();

-- Verify insertion
SELECT COUNT(*) as total_institutions FROM institutions;
SELECT name, official_url FROM institutions ORDER BY created_at DESC LIMIT 5;
