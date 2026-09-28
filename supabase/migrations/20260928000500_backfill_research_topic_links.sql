-- Backfill only deterministic topic matches. No LLM classification is used.
insert into public.publication_topics (publication_id, topic_id)
select p.id, t.id
from public.publications p
cross join public.research_topics t
where p.is_demo=false and t.active=true
  and (
    (t.name='Environmental Remote Sensing' and (coalesce(p.title,'')||' '||coalesce(p.abstract,'')) ~* '(remote sensing|earth observation|satellite|hyperspectral|radar|sar)')
    or (t.name='Foundation Models for Earth Observation' and (coalesce(p.title,'')||' '||coalesce(p.abstract,'')) ~* 'foundation model')
    or (t.name='Multimodal Earth Observation' and (coalesce(p.title,'')||' '||coalesce(p.abstract,'')) ~* '(multimodal.*earth observation|earth observation.*multimodal)')
    or (t.name='Geomatics' and (coalesce(p.title,'')||' '||coalesce(p.abstract,'')) ~* '(geomatics|geodes(y|ic)|geoinformatics|photogrammetr)')
    or (t.name='3D GIS' and (coalesce(p.title,'')||' '||coalesce(p.abstract,'')) ~* '(gis|3d gis|citygml|lidar|point cloud|3d reconstruction|laser scanning)')
    or (t.name='UAV Mapping' and (coalesce(p.title,'')||' '||coalesce(p.abstract,'')) ~* '(uav|drone|aerial mapping|photogrammetr)')
    or (t.name='Urban Digital Twins' and (coalesce(p.title,'')||' '||coalesce(p.abstract,'')) ~* '(digital twin|geobim|citygml|urban)')
  )
on conflict do nothing;

insert into public.opportunity_topics (opportunity_id, topic_id)
select o.id, t.id
from public.opportunities o
cross join public.research_topics t
where o.is_demo=false and t.active=true
  and (
    (t.name='Environmental Remote Sensing' and (coalesce(o.title,'')||' '||coalesce(o.description,'')) ~* '(remote sensing|earth observation|satellite|hyperspectral)')
    or (t.name='Foundation Models for Earth Observation' and (coalesce(o.title,'')||' '||coalesce(o.description,'')) ~* 'foundation model')
    or (t.name='Multimodal Earth Observation' and (coalesce(o.title,'')||' '||coalesce(o.description,'')) ~* '(multimodal.*earth observation|earth observation.*multimodal)')
    or (t.name='Geomatics' and (coalesce(o.title,'')||' '||coalesce(o.description,'')) ~* '(geomatics|geodes(y|ic)|geoinformatics)')
    or (t.name='3D GIS' and (coalesce(o.title,'')||' '||coalesce(o.description,'')) ~* '(gis|3d gis|citygml)')
    or (t.name='UAV Mapping' and (coalesce(o.title,'')||' '||coalesce(o.description,'')) ~* '(uav|drone|aerial mapping)')
    or (t.name='Urban Digital Twins' and (coalesce(o.title,'')||' '||coalesce(o.description,'')) ~* '(digital twin|geobim|citygml)')
  )
on conflict do nothing;
