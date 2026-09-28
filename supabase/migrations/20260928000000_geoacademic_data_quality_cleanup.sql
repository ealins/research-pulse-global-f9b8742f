-- GeoAcademic data-quality cleanup applied 2026-09-28.
-- Keep institutional geography complete and correct known corrupted country fields.
update public.institutions set city='Keyworth', latitude=52.9070, longitude=-1.2350 where name='British Geological Survey';
update public.institutions set city='Paris', latitude=48.8613, longitude=2.3449 where name='CNES - Centre National d''Études Spatiales';
update public.institutions set city='Munich', latitude=48.1351, longitude=11.5820 where name='EGU - European Geosciences Union';
update public.institutions set country='Switzerland', country_code='CH', city='Zurich', latitude=47.3769, longitude=8.5481 where name='ETH Zurich Department of Earth Sciences';
update public.institutions set city='Paris', latitude=48.8467, longitude=2.3075 where name='European Space Agency';
update public.institutions set city='Geneva', latitude=46.2276, longitude=6.1368 where name='Group on Earth Observations';
update public.institutions set country='Austria', country_code='AT', city='Vienna', latitude=48.2082, longitude=16.3738 where name='ISPRS - International Society for Photogrammetry and Remote Sensing';
update public.institutions set country='United States', country_code='US', city='Cambridge', latitude=42.3601, longitude=-71.0942 where name='MIT Earth, Atmospheric and Planetary Sciences';
update public.institutions set city='Greenbelt', latitude=39.0000, longitude=-76.8500 where name='NASA Goddard Space Flight Center';
update public.institutions set country='United States', country_code='US', city='Stanford', latitude=37.4275, longitude=-122.1697 where name='Stanford Doerr School of Sustainability';
update public.institutions set city='Reston', latitude=38.9490, longitude=-77.3460 where name='U.S. Geological Survey';
update public.institutions set country='United States', country_code='US', city='Berkeley', latitude=37.8719, longitude=-122.2585 where name='UC Berkeley Earth and Planetary Science';
update public.institutions set country='United Kingdom', country_code='GB', city='Cambridge', latitude=52.2053, longitude=0.1218 where name='University of Cambridge Department of Earth Sciences';
update public.institutions set country='United Kingdom', country_code='GB', city='Oxford', latitude=51.7590, longitude=-1.2560 where name='University of Oxford Department of Earth Sciences';
update public.institutions set city='Tokyo', latitude=35.7120, longitude=139.7620 where name='University of Tokyo Department of Earth and Planetary Science';
