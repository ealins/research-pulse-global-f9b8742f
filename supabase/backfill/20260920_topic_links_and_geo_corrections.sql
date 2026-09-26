-- One-time production backfill: topic links + geo corrections
-- Generated 2026-09-20. Idempotent (ON CONFLICT DO NOTHING / plain UPDATEs).
-- Run in the Supabase SQL editor as a database owner / service role.
-- Safe to re-run.

BEGIN;

-- 1. opportunity -> topic links (powers Top picks, Matcher, topic dossiers)
INSERT INTO public.opportunity_topics (opportunity_id, topic_id) VALUES ('f371b304-b22b-451a-b839-a996024a8b8f', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.opportunity_topics (opportunity_id, topic_id) VALUES ('7a65321f-cc70-495f-a9f7-eddf5e7c7bea', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.opportunity_topics (opportunity_id, topic_id) VALUES ('9dc1e500-bef4-41df-bb30-97882299505c', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.opportunity_topics (opportunity_id, topic_id) VALUES ('4c942cbb-8b83-48d0-8833-17d757609861', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.opportunity_topics (opportunity_id, topic_id) VALUES ('51163491-61db-476c-976d-dbbd47aa54b4', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.opportunity_topics (opportunity_id, topic_id) VALUES ('986fec04-4ea6-4cd4-b55d-be51463cfc3a', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.opportunity_topics (opportunity_id, topic_id) VALUES ('7faba1b7-9b9d-42ea-9855-3589a8afe53e', '2ab8745c-a24a-4b89-a79e-0d6b8c960ff4') ON CONFLICT DO NOTHING;
INSERT INTO public.opportunity_topics (opportunity_id, topic_id) VALUES ('0445030b-4844-4ac0-a675-ba5a3c6fede9', '399262a3-9f59-482c-93ad-1a6a5fcaf4ef') ON CONFLICT DO NOTHING;
INSERT INTO public.opportunity_topics (opportunity_id, topic_id) VALUES ('0445030b-4844-4ac0-a675-ba5a3c6fede9', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;

-- 2. institution -> topic links (powers Atlas "with live calls", topic dossiers)
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('0cd1869b-c99c-4c01-8bce-91879942ae0f', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('0cd1869b-c99c-4c01-8bce-91879942ae0f', 'dc1481bd-48d2-46e3-b8b8-7294fc840b7e') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('e141f951-c20a-4495-893b-0d56476095e4', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('e141f951-c20a-4495-893b-0d56476095e4', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('3333c759-0f39-4408-ad9e-46a940831c90', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('917879f9-37c5-4b69-99c2-069140823bfa', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('917879f9-37c5-4b69-99c2-069140823bfa', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('2c8f2f84-be7f-481f-9770-3590d114fd41', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('2c8f2f84-be7f-481f-9770-3590d114fd41', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('74643b45-241b-4510-9e58-2d5867124db8', '399262a3-9f59-482c-93ad-1a6a5fcaf4ef') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('74643b45-241b-4510-9e58-2d5867124db8', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('74643b45-241b-4510-9e58-2d5867124db8', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('c3933950-a1a7-454d-9b81-94db6cf01fdc', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('c3933950-a1a7-454d-9b81-94db6cf01fdc', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('97a39c6c-a06b-4a4f-a441-bf422c917569', '399262a3-9f59-482c-93ad-1a6a5fcaf4ef') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('97a39c6c-a06b-4a4f-a441-bf422c917569', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('b6086385-db85-45dd-afc4-54052ebfc4ea', '2ab8745c-a24a-4b89-a79e-0d6b8c960ff4') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('b6086385-db85-45dd-afc4-54052ebfc4ea', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('736670db-5621-46a1-b023-f1068e5bab45', '399262a3-9f59-482c-93ad-1a6a5fcaf4ef') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('736670db-5621-46a1-b023-f1068e5bab45', 'dc1481bd-48d2-46e3-b8b8-7294fc840b7e') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('736670db-5621-46a1-b023-f1068e5bab45', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('9da82d0e-52a8-4e29-a76e-ad785ce1c887', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('7acc8f2d-9bc4-4688-8d34-cc4cf593dd1b', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('7acc8f2d-9bc4-4688-8d34-cc4cf593dd1b', '2ab8745c-a24a-4b89-a79e-0d6b8c960ff4') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('cc22d0b6-f61e-4bfe-8a3a-c86254d6fa7f', '2ab8745c-a24a-4b89-a79e-0d6b8c960ff4') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('cc22d0b6-f61e-4bfe-8a3a-c86254d6fa7f', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('af972daa-3ef6-4544-bfd9-f966f9a6e26e', '2ab8745c-a24a-4b89-a79e-0d6b8c960ff4') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('af972daa-3ef6-4544-bfd9-f966f9a6e26e', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('5d9a09bc-ab4e-4a4f-b240-4b306c3182ab', '2ab8745c-a24a-4b89-a79e-0d6b8c960ff4') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_topics (institution_id, topic_id) VALUES ('5d9a09bc-ab4e-4a4f-b240-4b306c3182ab', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;

-- 3. researcher -> topic links
INSERT INTO public.researcher_topics (researcher_id, topic_id) VALUES ('38153274-f6e0-4465-a306-98dea4a3f6e5', '2ab8745c-a24a-4b89-a79e-0d6b8c960ff4') ON CONFLICT DO NOTHING;
INSERT INTO public.researcher_topics (researcher_id, topic_id) VALUES ('38153274-f6e0-4465-a306-98dea4a3f6e5', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;

-- 4. project -> topic links
INSERT INTO public.project_topics (project_id, topic_id) VALUES ('e64085fe-f5a2-4168-9db1-ca601f82827b', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.project_topics (project_id, topic_id) VALUES ('2102708e-f45b-4d3c-9440-585eefe05cf1', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.project_topics (project_id, topic_id) VALUES ('2102708e-f45b-4d3c-9440-585eefe05cf1', '2ab8745c-a24a-4b89-a79e-0d6b8c960ff4') ON CONFLICT DO NOTHING;
INSERT INTO public.project_topics (project_id, topic_id) VALUES ('9c22ddc1-a180-4db8-af44-894ca6a6b6fb', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.project_topics (project_id, topic_id) VALUES ('9c22ddc1-a180-4db8-af44-894ca6a6b6fb', '2ab8745c-a24a-4b89-a79e-0d6b8c960ff4') ON CONFLICT DO NOTHING;

-- 5. publication -> topic links (keyword-classified 2026-09-20; powers Trends, topic dossiers)
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('12944a4b-b385-4f82-b4bc-42f39764e173', '2ab8745c-a24a-4b89-a79e-0d6b8c960ff4') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('753538f8-a16d-4fa9-94f9-1a54dcedb37c', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('86355500-da4e-4c76-93af-868a37153080', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('0f5015a8-4951-45a9-9b54-e8be50c16c1b', '399262a3-9f59-482c-93ad-1a6a5fcaf4ef') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('cf117b7d-e8e3-4a74-aba7-168a22a1d361', '399262a3-9f59-482c-93ad-1a6a5fcaf4ef') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('abc3361c-83e8-4ed6-90a4-ee0130eacc9a', '2ab8745c-a24a-4b89-a79e-0d6b8c960ff4') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('670df8be-e9a7-4961-b0d3-0414e1ae352e', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('2f74e966-629e-41bc-a6d4-d8ecbec05b73', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('80bd816a-dfe3-4692-b3f4-160f366427a6', '2ab8745c-a24a-4b89-a79e-0d6b8c960ff4') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('95ad34c4-0b4e-4618-b8fc-eaa6acf57f5d', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('f3a92aa1-cae8-4480-a709-00875cc41b6f', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('b170fd56-b945-4e1c-bc24-3e43909cde97', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('aaf4b1c0-3cc3-425b-bcd1-02aaf68da960', '2139dc1a-be13-4791-a2b1-761300162fb7') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('57ac0081-31a2-4968-8122-ad8ce9b41ea3', 'dc1481bd-48d2-46e3-b8b8-7294fc840b7e') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('57ac0081-31a2-4968-8122-ad8ce9b41ea3', 'b0112c2a-ce8a-4819-b529-79e0a388972a') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('57ac0081-31a2-4968-8122-ad8ce9b41ea3', '399262a3-9f59-482c-93ad-1a6a5fcaf4ef') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('bc8d8929-cbec-44f5-8e58-4df20522c43b', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('4d5f72f0-9523-47e2-86bc-ed38a58cd2bb', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('4ff8d97e-13b2-4090-83c4-bb160efbd77a', 'b0112c2a-ce8a-4819-b529-79e0a388972a') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('46ef2532-23b7-420b-858a-fffaa10d5dc7', '2ab8745c-a24a-4b89-a79e-0d6b8c960ff4') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('f47a2d42-bd02-40f7-a8ea-09d3ec8d0234', 'b0112c2a-ce8a-4819-b529-79e0a388972a') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('4f0a1a5d-5840-459d-a169-660a9a03f689', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('b9876286-3a9e-4764-aedf-65ca21a54afe', '2ab8745c-a24a-4b89-a79e-0d6b8c960ff4') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('f85e8d4b-7c14-4cab-bf10-d50d7e523dd4', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('199e9fe9-9697-4504-998b-ad790d55bc8a', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('f8bee419-9444-4cdc-9700-a812b454455f', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('fd407da1-b119-4437-bf09-97c68bff0a4f', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('2428fbe0-25ab-45cf-899d-f441f2a95d9e', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('cf055c89-d542-46ab-9565-bcb19a9ee5e0', '2139dc1a-be13-4791-a2b1-761300162fb7') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('70c8b1d1-42a6-4bf0-a081-49db93c0b1f0', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('c34d2c44-58fb-4339-8fa7-342483fcc040', 'dc1481bd-48d2-46e3-b8b8-7294fc840b7e') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('c34d2c44-58fb-4339-8fa7-342483fcc040', '399262a3-9f59-482c-93ad-1a6a5fcaf4ef') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('ae14a7cf-4804-46ae-a47a-7fbf95d0b846', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('40d0f143-4876-4557-be87-8e1a8ba721ee', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('ad37a27b-9593-4674-824a-12b69d63c8fc', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('364f07df-2266-4c0b-a6cf-7d17a1c5ec8c', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('99005af3-bd04-451e-b99a-3abf63d31b57', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('8b1fc5d9-fdf7-4e38-91ea-3e5eb68b92d1', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('4ede6eec-bcae-4b33-8a0a-8fea0d4a6e9e', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('5fa03a5c-f080-4db3-9d8c-9da17bd5f30e', '2ab8745c-a24a-4b89-a79e-0d6b8c960ff4') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('c95168ae-f121-43a9-a5c4-11fe9dacf139', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('cacffcde-83ce-4f7b-9ef1-57b928a4a064', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('9fe291ce-351e-4632-9481-df2f0cd48d72', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('8d9f221a-9708-4d84-aa3d-b4931506d440', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('dd58e7aa-cec6-48e7-8993-091b49d2f9ab', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('c621060a-b202-497d-b768-6009ac240aef', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('384db85e-38d1-4e11-9d2c-288464a8058c', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('9f7e120f-ae0a-4572-b421-bf9863d23f42', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('39b83a25-ec64-4962-a97b-cf356b589bc3', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('e6da4cb5-b65a-485a-9d74-e5e9848fac5f', '2ab8745c-a24a-4b89-a79e-0d6b8c960ff4') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('33b45597-2edc-421b-9950-f2cf1a76e35e', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('1af8fe2e-6e1c-4e53-af57-2eef039af6d5', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('7234f5c2-d7f3-496b-b4ce-cbeab480c1fb', '399262a3-9f59-482c-93ad-1a6a5fcaf4ef') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('1d31b223-0707-4f67-83da-3316cc88829a', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('33c5f6c8-9292-4636-9caa-aa1feb54efc7', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('73cb5ac1-669a-4571-be5f-19fb82eda53e', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('17ba3267-5018-4e52-8052-9b3b25ebb949', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('f74175a2-3c3f-4cf3-aef5-561f56717ea2', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('9a28b771-7165-4685-ad20-266f4b0fa10c', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('f6f0ef33-b6a7-4438-b6e1-9830c241fe71', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('44ceff90-fe67-4f07-83d0-25238397dfa0', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('c840617f-c196-41aa-8649-b407d6016e26', '399262a3-9f59-482c-93ad-1a6a5fcaf4ef') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('221735cd-d5c0-4692-9d76-fc3307229913', '2ab8745c-a24a-4b89-a79e-0d6b8c960ff4') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('c713e28d-d151-4fde-b457-87d7c02b2c17', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('e11872d3-cc34-4ec0-91d0-b9ff2e0388b8', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('231a246f-9378-42d8-8381-7ed48579259f', '399262a3-9f59-482c-93ad-1a6a5fcaf4ef') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('c8a40dc6-c409-4dae-9ca3-c18c31520176', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('fa858994-2565-41d1-9b4c-e7efbc9a04cb', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('a4512085-3184-4cdc-ad1c-45f526164c2d', 'b0112c2a-ce8a-4819-b529-79e0a388972a') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('a4512085-3184-4cdc-ad1c-45f526164c2d', '399262a3-9f59-482c-93ad-1a6a5fcaf4ef') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('a03a8ed9-059b-4bd5-953c-3866ab65eb5d', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('c6d87de2-7d5c-4c40-91c2-eacdfb879b6f', 'dc1481bd-48d2-46e3-b8b8-7294fc840b7e') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('5663429b-1e1a-4d3f-91fb-801f6467ee23', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('04c76fd8-10de-4d23-802a-907da64dc20f', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('e3a6b4a2-4fc8-4244-9754-2b03f26999fb', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('be3a5980-d85f-430b-8767-24b35c25ba6a', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('4d6d9498-8305-4985-9676-97bd8bae3c4b', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('048ee0eb-71d9-4e3c-ab2a-57ff3964a52e', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('311b7826-ece9-4d20-bf2b-c6570da6a295', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('739dcf83-ed64-4ed9-bc4c-c9d7dd8149b0', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('eaa0fd79-b70a-4c0c-a96a-7ea480129a04', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('681b838e-01ca-4853-84bd-a0073e85368d', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('6365d968-e951-48f9-a4cf-cbaca9355aab', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('83bb0a8f-d8c1-42de-83e6-31c60738c435', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('cdae82b6-ca66-43a4-bb41-638a99dc5475', 'b0112c2a-ce8a-4819-b529-79e0a388972a') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('4fb3276e-d40a-4868-ad92-161b8a73ec86', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('ac7d72f4-bcc5-434d-a03b-c8c48ff995b4', '399262a3-9f59-482c-93ad-1a6a5fcaf4ef') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('4d2a2273-12a1-46e9-9886-9d8134b36abc', '399262a3-9f59-482c-93ad-1a6a5fcaf4ef') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('2b713125-ab0c-46aa-b626-4d3f373cdb17', '399262a3-9f59-482c-93ad-1a6a5fcaf4ef') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('48f60656-a47c-41ef-a29a-d652cf481ed6', 'dc1481bd-48d2-46e3-b8b8-7294fc840b7e') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('48f60656-a47c-41ef-a29a-d652cf481ed6', '399262a3-9f59-482c-93ad-1a6a5fcaf4ef') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('754f537c-3e83-4124-b82b-462fb2ab34e3', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('279697a5-c3b1-4229-914c-1bf9f8f80dc6', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('27516d47-a759-4296-b80b-c664d8c15fbc', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('02a8b981-7812-4b69-af9d-7cfac98d2604', '399262a3-9f59-482c-93ad-1a6a5fcaf4ef') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('bdcd1392-598e-4f03-845d-03cd94ffab98', '2ab8745c-a24a-4b89-a79e-0d6b8c960ff4') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('d860afcd-c595-4ef9-9cb8-be24ee702aa0', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('ac4ee053-8a5a-4dc4-ba2b-33c412c9601b', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('26ad05a3-2130-4608-9b17-f1431b6ee575', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('8120c4b7-2803-4796-a4f8-01df463b5513', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('8dc89661-2d86-4c63-913f-4d600aa064c1', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('2f5c21a2-0a8a-4a5f-8caa-67840c3f9bdd', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('9791d8c9-ffa8-4040-9e99-ba1fc06f9c33', '399262a3-9f59-482c-93ad-1a6a5fcaf4ef') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('a79d6f09-ca6d-4d40-b9ff-77f46deaebb0', '2ab8745c-a24a-4b89-a79e-0d6b8c960ff4') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('3f634ba4-41f6-4eab-893b-3d765682796e', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('180b79a4-cedb-43fc-965b-0e6e4c2407f0', '399262a3-9f59-482c-93ad-1a6a5fcaf4ef') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('b1444a0a-2576-43c6-b648-d18c4a30fa73', '399262a3-9f59-482c-93ad-1a6a5fcaf4ef') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('9ccd5a3d-476f-4f80-971b-6a61b05f508a', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('ba55c242-7183-4fbb-9ed6-98b606c0cd3b', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('b9a49d30-eca4-4163-ade7-53619886d792', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('d0857097-d4e4-4e49-aa8d-b8025f247d18', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('63813a8f-ac8c-4237-a934-5aacccf1c5d2', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('90e23f8b-436f-4cfc-aad6-09ad88bd1168', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('29b2b8d1-653a-4e88-96de-4b01d66f2a89', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('dbfa4536-af9b-4335-bb50-919671dbb145', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('d24673ca-db64-47ef-b5aa-087bcc97231a', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('54132021-c530-4b8a-b1f1-792f57a381b2', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('85d0fa83-b364-463e-a49d-4842cc0c97fe', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('3fd0f52b-420f-4020-88a5-73b726a2398e', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('ed9a2619-dfc8-4bd3-8d2c-b58089bf536c', '2ab8745c-a24a-4b89-a79e-0d6b8c960ff4') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('ed9a2619-dfc8-4bd3-8d2c-b58089bf536c', '399262a3-9f59-482c-93ad-1a6a5fcaf4ef') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('412d5d35-24f2-4e29-9385-5014682d4105', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('180a4611-07fc-4561-b15c-e51423341a46', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('f45ee5a9-d1bc-4400-8861-da24d69489c7', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('5d666aad-bc0f-4f09-895a-730e3d79a4d5', '2ab8745c-a24a-4b89-a79e-0d6b8c960ff4') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('014a1e32-e8e0-4783-bf97-9d5851effa65', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('d8932597-7460-4156-8dad-21cc7227237f', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('194cf055-1960-418c-bb29-006ca90089bb', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('1e7a21b1-385a-4adb-8e2a-cfd7fb53858c', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('bd313a99-68a7-4724-997b-667b318dafac', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('a661e23c-ec12-4e7c-8f0d-a72398fe4b47', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('b0e198a1-d2de-4b50-a7a9-71fcb4bc3138', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('d4e3d750-c6fd-4c01-8e40-ed489f3f5098', '399262a3-9f59-482c-93ad-1a6a5fcaf4ef') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('ec160095-5c7c-4f26-b831-ad9867ef360f', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('632b5715-87f2-419a-9146-19dfe35ecd5e', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('e708007c-89fc-4ed9-aec0-d735ca3d2ae5', '399262a3-9f59-482c-93ad-1a6a5fcaf4ef') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('34dbbc6a-44f9-4737-9d2a-a53cc96c4f7f', '2ab8745c-a24a-4b89-a79e-0d6b8c960ff4') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('537bd981-1967-4e33-8668-05dd494538d3', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('47b36a48-7021-4a20-8113-99f717f8f218', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('5ce13325-6134-4fd1-8411-e89db3e708f3', 'ee61aa1b-f2fe-40de-98bc-07040d4723e3') ON CONFLICT DO NOTHING;
INSERT INTO public.publication_topics (publication_id, topic_id) VALUES ('3071f046-adc1-4f07-b2a3-4ab84bdbc912', 'aaa6abd8-f50b-46a5-826d-935add7ed217') ON CONFLICT DO NOTHING;

-- 6. country corrections (Cambridge/Oxford -> United Kingdom, ETH Zurich -> Switzerland; fill obvious nulls)
UPDATE public.institutions SET country = 'United Kingdom', city = 'Cambridge' WHERE id = 'c3933950-a1a7-454d-9b81-94db6cf01fdc';
UPDATE public.institutions SET country = 'United Kingdom', city = 'Oxford' WHERE id = '9da82d0e-52a8-4e29-a76e-ad785ce1c887';
UPDATE public.institutions SET country = 'Switzerland', city = 'Zurich' WHERE id = '736670db-5621-46a1-b023-f1068e5bab45';
UPDATE public.institutions SET country = 'United States', city = 'Cambridge' WHERE id = 'e141f951-c20a-4495-893b-0d56476095e4' AND country IS NULL;
UPDATE public.institutions SET country = 'United States', city = 'Stanford' WHERE id = '3333c759-0f39-4408-ad9e-46a940831c90' AND country IS NULL;
UPDATE public.institutions SET country = 'United States', city = 'Berkeley' WHERE id = '917879f9-37c5-4b69-99c2-069140823bfa' AND country IS NULL;
UPDATE public.institutions SET city = 'Munich' WHERE id = '2c8f2f84-be7f-481f-9770-3590d114fd41' AND city IS NULL;
UPDATE public.institutions SET city = 'Reston' WHERE id = '74643b45-241b-4510-9e58-2d5867124db8' AND city IS NULL;
UPDATE public.institutions SET city = 'Keyworth' WHERE id = '97a39c6c-a06b-4a4f-a441-bf422c917569' AND city IS NULL;
UPDATE public.institutions SET city = 'Geneva' WHERE id = 'b6086385-db85-45dd-afc4-54052ebfc4ea' AND city IS NULL;
UPDATE public.institutions SET city = 'Tokyo' WHERE id = '7acc8f2d-9bc4-4688-8d34-cc4cf593dd1b' AND city IS NULL;
UPDATE public.institutions SET city = 'Paris' WHERE id IN ('cc22d0b6-f61e-4bfe-8a3a-c86254d6fa7f','af972daa-3ef6-4544-bfd9-f966f9a6e26e') AND city IS NULL;
UPDATE public.institutions SET city = 'Greenbelt' WHERE id = '5d9a09bc-ab4e-4a4f-b240-4b306c3182ab' AND city IS NULL;

-- 7. coordinates (verified HQ/campus locations; ISPRS is a distributed society -> left null deliberately)
UPDATE public.institutions SET latitude = 42.3601, longitude = -71.0910 WHERE id = 'e141f951-c20a-4495-893b-0d56476095e4';
UPDATE public.institutions SET latitude = 37.4275, longitude = -122.1707 WHERE id = '3333c759-0f39-4408-ad9e-46a940831c90';
UPDATE public.institutions SET latitude = 37.8735, longitude = -122.2573 WHERE id = '917879f9-37c5-4b69-99c2-069140823bfa';
UPDATE public.institutions SET latitude = 48.1351, longitude = 11.5820 WHERE id = '2c8f2f84-be7f-481f-9770-3590d114fd41';
UPDATE public.institutions SET latitude = 38.9472, longitude = -77.3753 WHERE id = '74643b45-241b-4510-9e58-2d5867124db8';
UPDATE public.institutions SET latitude = 52.2035, longitude = 0.1196 WHERE id = 'c3933950-a1a7-454d-9b81-94db6cf01fdc';
UPDATE public.institutions SET latitude = 52.8777, longitude = -1.0744 WHERE id = '97a39c6c-a06b-4a4f-a441-bf422c917569';
UPDATE public.institutions SET latitude = 46.2225, longitude = 6.1412 WHERE id = 'b6086385-db85-45dd-afc4-54052ebfc4ea';
UPDATE public.institutions SET latitude = 47.3769, longitude = 8.5417 WHERE id = '736670db-5621-46a1-b023-f1068e5bab45';
UPDATE public.institutions SET latitude = 51.7590, longitude = -1.2583 WHERE id = '9da82d0e-52a8-4e29-a76e-ad785ce1c887';
UPDATE public.institutions SET latitude = 35.7127, longitude = 139.7619 WHERE id = '7acc8f2d-9bc4-4688-8d34-cc4cf593dd1b';
UPDATE public.institutions SET latitude = 48.8472, longitude = 2.3551 WHERE id = 'cc22d0b6-f61e-4bfe-8a3a-c86254d6fa7f';
UPDATE public.institutions SET latitude = 48.8486, longitude = 2.3065 WHERE id = 'af972daa-3ef6-4544-bfd9-f966f9a6e26e';
UPDATE public.institutions SET latitude = 38.9921, longitude = -76.8529 WHERE id = '5d9a09bc-ab4e-4a4f-b240-4b306c3182ab';

-- 8. recompute trend signals now that links exist
SELECT public.refresh_topic_momentum();

-- 9. global search: also match institutions by city/country (e.g. "Munich").
--    Same body as supabase/migrations/20260920120000_global_search_location_match.sql.
CREATE OR REPLACE FUNCTION public.global_search(q text, max_results integer DEFAULT 20)
RETURNS TABLE (
  entity_type text,
  entity_id uuid,
  slug text,
  title text,
  subtitle text,
  score real
)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  WITH needle AS (SELECT btrim(q) AS n)
  SELECT * FROM (
    SELECT 'institution'::text, i.id, i.slug, i.name,
           concat_ws(', ', i.city, i.country),
           similarity(i.name, (SELECT n FROM needle))
             + CASE WHEN i.name ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.4 ELSE 0 END
             + CASE WHEN coalesce(i.city,'') ILIKE '%'||(SELECT n FROM needle)||'%'
                      OR coalesce(i.country,'') ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.2 ELSE 0 END
    FROM public.institutions i
    WHERE i.is_demo = false
      AND i.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
      AND (
        EXISTS (SELECT 1 FROM public.institution_topics it WHERE it.institution_id = i.id)
        OR EXISTS (SELECT 1 FROM public.researcher_topics rt JOIN public.researchers r ON r.id = rt.researcher_id WHERE r.institution_id = i.id AND r.is_demo = false)
        OR EXISTS (SELECT 1 FROM public.project_topics pt JOIN public.projects p ON p.id = pt.project_id WHERE p.institution_id = i.id AND p.is_demo = false)
        OR EXISTS (SELECT 1 FROM public.publication_topics pt JOIN public.publications p ON p.id = pt.publication_id WHERE p.institution_id = i.id AND p.is_demo = false)
        OR EXISTS (SELECT 1 FROM public.course_topics ct JOIN public.courses c ON c.id = ct.course_id WHERE c.institution_id = i.id AND c.is_demo = false)
      )
      AND (i.name ILIKE '%'||(SELECT n FROM needle)||'%'
        OR coalesce(i.abbreviation,'') ILIKE '%'||(SELECT n FROM needle)||'%'
        OR coalesce(i.city,'') ILIKE '%'||(SELECT n FROM needle)||'%'
        OR coalesce(i.country,'') ILIKE '%'||(SELECT n FROM needle)||'%'
        OR similarity(i.name,(SELECT n FROM needle)) > 0.25)
    UNION ALL
    SELECT 'researcher', r.id, r.slug, r.full_name, concat_ws(' — ', r.academic_title, i.name),
           similarity(r.full_name,(SELECT n FROM needle))
             + CASE WHEN r.full_name ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.4 ELSE 0 END
    FROM public.researchers r
    LEFT JOIN public.institutions i ON i.id = r.institution_id AND i.is_demo = false
    WHERE r.is_demo = false
      AND r.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
      AND EXISTS (SELECT 1 FROM public.researcher_topics rt WHERE rt.researcher_id = r.id)
      AND (r.full_name ILIKE '%'||(SELECT n FROM needle)||'%'
        OR similarity(r.full_name,(SELECT n FROM needle)) > 0.25)
    UNION ALL
    SELECT 'topic', t.id, t.slug, t.name, t.category,
           similarity(t.name,(SELECT n FROM needle))
             + CASE WHEN t.name ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.4 ELSE 0 END
    FROM public.research_topics t
    WHERE t.active = true
      AND (t.name ILIKE '%'||(SELECT n FROM needle)||'%'
        OR similarity(t.name,(SELECT n FROM needle)) > 0.25)
    UNION ALL
    SELECT 'opportunity', o.id, o.slug, o.title, concat_ws(' — ', i.name, o.country),
           similarity(o.title,(SELECT n FROM needle))
             + CASE WHEN o.title ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.4 ELSE 0 END
    FROM public.opportunities o
    LEFT JOIN public.institutions i ON i.id = o.institution_id AND i.is_demo = false
    WHERE o.is_demo = false
      AND o.status IN ('open', 'closing_soon', 'rolling', 'possibly_open')
      AND o.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
      AND o.confidence IN ('high', 'medium')
      AND o.official_source_url IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.opportunity_topics ot WHERE ot.opportunity_id = o.id)
      AND (o.title ILIKE '%'||(SELECT n FROM needle)||'%'
        OR similarity(o.title,(SELECT n FROM needle)) > 0.25)
    UNION ALL
    SELECT 'programme', c.id, c.slug, c.title, concat_ws(' — ', c.degree_type, i.name),
           similarity(c.title,(SELECT n FROM needle))
             + CASE WHEN c.title ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.4 ELSE 0 END
    FROM public.courses c
    LEFT JOIN public.institutions i ON i.id = c.institution_id AND i.is_demo = false
    WHERE c.is_demo = false
      AND c.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
      AND EXISTS (SELECT 1 FROM public.course_topics ct WHERE ct.course_id = c.id)
      AND (c.title ILIKE '%'||(SELECT n FROM needle)||'%'
        OR similarity(c.title,(SELECT n FROM needle)) > 0.25)
    UNION ALL
    SELECT 'project', p.id, p.slug, p.name, coalesce(p.acronym, i.name),
           similarity(p.name,(SELECT n FROM needle))
             + CASE WHEN p.name ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.4 ELSE 0 END
    FROM public.projects p
    LEFT JOIN public.institutions i ON i.id = p.institution_id AND i.is_demo = false
    WHERE p.is_demo = false
      AND p.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
      AND EXISTS (SELECT 1 FROM public.project_topics pt WHERE pt.project_id = p.id)
      AND (p.name ILIKE '%'||(SELECT n FROM needle)||'%'
        OR coalesce(p.acronym,'') ILIKE '%'||(SELECT n FROM needle)||'%'
        OR similarity(p.name,(SELECT n FROM needle)) > 0.25)
    UNION ALL
    SELECT 'publication', pb.id, pb.id::text, pb.title, concat_ws(' · ', pb.venue, pb.year::text),
           similarity(pb.title,(SELECT n FROM needle))
             + CASE WHEN pb.title ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.4 ELSE 0 END
    FROM public.publications pb
    WHERE pb.is_demo = false
      AND pb.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
      AND EXISTS (SELECT 1 FROM public.publication_topics pt WHERE pt.publication_id = pb.id)
      AND (pb.title ILIKE '%'||(SELECT n FROM needle)||'%'
        OR similarity(pb.title,(SELECT n FROM needle)) > 0.3)
    UNION ALL
    SELECT 'event', e.id, e.slug, e.title, concat_ws(' · ', e.organization, e.location),
           similarity(e.title,(SELECT n FROM needle))
             + CASE WHEN e.title ILIKE '%'||(SELECT n FROM needle)||'%' THEN 0.4 ELSE 0 END
    FROM public.events e
    WHERE e.is_demo = false
      AND e.verification_status IN ('verified', 'auto_discovered', 'possibly_outdated')
      AND EXISTS (SELECT 1 FROM public.event_topics et WHERE et.event_id = e.id)
      AND (e.title ILIKE '%'||(SELECT n FROM needle)||'%'
        OR similarity(e.title,(SELECT n FROM needle)) > 0.25)
  ) s(entity_type, entity_id, slug, title, subtitle, score)
  WHERE (SELECT length(n) FROM needle) >= 2
  ORDER BY score DESC NULLS LAST
  LIMIT greatest(1, least(max_results, 50));
$$;


COMMIT;
