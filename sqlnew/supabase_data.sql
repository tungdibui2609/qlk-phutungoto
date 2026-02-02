SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict rEX3D92MNpap4sg3ZfRRfRfLou5w7BwnCuW37TueXvy4b0YOuRg1KfrY9Mr0qSO

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."flow_state" ("id", "user_id", "auth_code", "code_challenge_method", "code_challenge", "provider_type", "provider_access_token", "provider_refresh_token", "created_at", "updated_at", "authentication_method", "auth_code_issued_at") VALUES
	('b0b79c20-af87-4d7b-9ccf-ea72b9b23a31', '1a5f0b82-a4be-4ba7-82ab-fdc8cee7734a', 'ecef061c-c7df-41c3-abf9-06919c351b39', 's256', '3GfYH8G55Kcw2G14CV7QuTUPAWod8TKg0H6J1aswMjw', 'email', '', '', '2026-01-19 11:04:51.712649+00', '2026-01-19 11:04:51.712649+00', 'email/signup', NULL);


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', '8560fd3f-170f-4c54-bba8-86cf8ea09699', 'authenticated', 'authenticated', 'tabc.thukho@system.local', '$2a$10$naWw4oswEdFxt7ZjtNF3lew4gHybrbs/a4BYmg7KDFdKYL8l3IUHO', '2026-02-01 05:42:01.401435+00', NULL, '', NULL, '', NULL, '', '', NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{"username": "tabc.thukho", "email_verified": true}', NULL, '2026-02-01 05:42:01.306339+00', '2026-02-01 05:42:01.403041+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'a0ad4b7a-e0e5-42a0-bb06-4aa2b07c0018', 'authenticated', 'authenticated', 'tabc.thukho2@system.local', '$2a$10$pNta2AsOWuGy9qdPLVniheM9nx1ThkH8u3n0a13wcJEhTWr2eONYu', '2026-02-01 06:25:08.87756+00', NULL, '', NULL, '', NULL, '', '', NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{"username": "tabc.thukho2", "email_verified": true}', NULL, '2026-02-01 06:25:08.845265+00', '2026-02-01 06:25:08.880649+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '1d502b01-df8b-4f27-9965-fa550a5b4096', 'authenticated', 'authenticated', 'tungdibui2609@gmail.com', '$2a$10$oroymheP6JbJAy6UWCx1sum4MNq//C4qr42Bw0SmiNa1uqq1AmgUe', '2026-01-29 08:20:29.897603+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-02-02 09:28:07.425372+00', '{"provider": "email", "providers": ["email"]}', '{"avatar_url": "https://res.cloudinary.com/diiyp32xv/image/upload/v1769758981/admin_avatars/admin_avatar_1d502b01-df8b-4f27-9965-fa550a5b4096.png", "email_verified": true}', NULL, '2026-01-29 08:20:29.897603+00', '2026-02-02 09:28:07.463417+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '9bbeaa84-90d9-4064-a692-c58724a6228b', 'authenticated', 'authenticated', 'traicayabc@gmail.com', '$2a$10$dZ5ePhqYeD03U5WzpYvDZONzqVa150VHMVEz1sg48Xh.ckCpWtwP6', '2026-01-30 07:47:19.320603+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-02-02 07:25:40.584996+00', '{"provider": "email", "providers": ["email"]}', '{"full_name": "HTX Trái Cây ABC", "email_verified": true}', NULL, '2026-01-30 07:47:19.277558+00', '2026-02-02 09:37:58.348337+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('1d502b01-df8b-4f27-9965-fa550a5b4096', '1d502b01-df8b-4f27-9965-fa550a5b4096', '{"sub": "1d502b01-df8b-4f27-9965-fa550a5b4096", "email": "tungdibui2609@gmail.com", "email_verified": true, "phone_verified": false}', 'email', '2026-01-29 08:20:29.897603+00', '2026-01-29 08:20:29.897603+00', '2026-01-29 08:20:29.897603+00', 'e57966b4-04c0-4396-ae69-64083d811b68'),
	('9bbeaa84-90d9-4064-a692-c58724a6228b', '9bbeaa84-90d9-4064-a692-c58724a6228b', '{"sub": "9bbeaa84-90d9-4064-a692-c58724a6228b", "email": "traicayabc@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2026-01-30 07:47:19.316008+00', '2026-01-30 07:47:19.316723+00', '2026-01-30 07:47:19.316723+00', 'a08a9647-e12c-47ef-942c-64cc209e519a'),
	('8560fd3f-170f-4c54-bba8-86cf8ea09699', '8560fd3f-170f-4c54-bba8-86cf8ea09699', '{"sub": "8560fd3f-170f-4c54-bba8-86cf8ea09699", "email": "tabc.thukho@system.local", "email_verified": false, "phone_verified": false}', 'email', '2026-02-01 05:42:01.391693+00', '2026-02-01 05:42:01.391758+00', '2026-02-01 05:42:01.391758+00', '7ac2d198-fabb-433f-8b12-bd2356da1b94'),
	('a0ad4b7a-e0e5-42a0-bb06-4aa2b07c0018', 'a0ad4b7a-e0e5-42a0-bb06-4aa2b07c0018', '{"sub": "a0ad4b7a-e0e5-42a0-bb06-4aa2b07c0018", "email": "tabc.thukho2@system.local", "email_verified": false, "phone_verified": false}', 'email', '2026-02-01 06:25:08.871495+00', '2026-02-01 06:25:08.872155+00', '2026-02-01 06:25:08.872155+00', '095ae313-8d89-4ec7-bad5-6de3e9a473dc');


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag", "oauth_client_id", "refresh_token_hmac_key", "refresh_token_counter", "scopes") VALUES
	('0b4a7733-e1e6-49f7-81ae-894ae114e6ec', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 10:17:45.270418+00', '2026-02-01 11:16:38.503081+00', NULL, 'aal1', NULL, '2026-02-01 11:16:38.502969', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '14.226.144.3', NULL, NULL, NULL, NULL, NULL),
	('c2d5ccca-35bd-46aa-9076-dfeaaa64be9e', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 07:37:26.975645+00', '2026-02-01 15:22:10.659475+00', NULL, 'aal1', NULL, '2026-02-01 15:22:10.659352', 'Vercel Edge Functions', '54.179.143.170', NULL, NULL, NULL, NULL, NULL),
	('1c845058-1a78-4c09-ba60-abc4ae421775', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 16:44:32.464643+00', '2026-02-01 17:43:04.655185+00', NULL, 'aal1', NULL, '2026-02-01 17:43:04.655068', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '14.226.144.3', NULL, NULL, NULL, NULL, NULL),
	('b486fbf8-e40b-4c4b-b927-de53b5a9deb7', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 07:41:16.222509+00', '2026-02-01 17:44:34.863509+00', NULL, 'aal1', NULL, '2026-02-01 17:44:34.863382', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '14.226.144.3', NULL, NULL, NULL, NULL, NULL),
	('319f2982-dcc1-447f-9ac2-46eed2047394', '1d502b01-df8b-4f27-9965-fa550a5b4096', '2026-02-01 15:31:31.446748+00', '2026-02-01 17:56:58.193708+00', NULL, 'aal1', NULL, '2026-02-01 17:56:58.18674', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '14.226.144.3', NULL, NULL, NULL, NULL, NULL),
	('a4025ed5-7282-481e-8440-096e61de70d0', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 07:51:48.942715+00', '2026-02-02 06:23:26.792624+00', NULL, 'aal1', NULL, '2026-02-02 06:23:26.792507', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '14.243.91.218', NULL, NULL, NULL, NULL, NULL),
	('69f8f353-a534-4c9a-b457-7e59a4cda002', '1d502b01-df8b-4f27-9965-fa550a5b4096', '2026-02-02 09:28:07.427915+00', '2026-02-02 09:28:07.427915+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '14.243.91.218', NULL, NULL, NULL, NULL, NULL),
	('ad92e609-4065-4dc9-9388-66bc2c2dd0d8', '1d502b01-df8b-4f27-9965-fa550a5b4096', '2026-02-01 07:35:06.121068+00', '2026-02-01 07:35:06.121068+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '14.243.91.218', NULL, NULL, NULL, NULL, NULL),
	('cf0f9fbb-c210-4b0d-a046-41580c831add', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 08:24:05.437104+00', '2026-02-01 08:24:05.437104+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36', '14.226.144.3', NULL, NULL, NULL, NULL, NULL),
	('e54de16c-b63e-4672-9abb-ba5cf9492999', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-02 07:25:40.585115+00', '2026-02-02 09:37:58.357325+00', NULL, 'aal1', NULL, '2026-02-02 09:37:58.35721', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '14.243.91.218', NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") VALUES
	('ad92e609-4065-4dc9-9388-66bc2c2dd0d8', '2026-02-01 07:35:06.166723+00', '2026-02-01 07:35:06.166723+00', 'password', '0e04a91e-47d1-461c-861d-ce878d6da15c'),
	('c2d5ccca-35bd-46aa-9076-dfeaaa64be9e', '2026-02-01 07:37:26.978675+00', '2026-02-01 07:37:26.978675+00', 'password', '3731f57b-7c7d-48f2-805e-6e0af6633861'),
	('b486fbf8-e40b-4c4b-b927-de53b5a9deb7', '2026-02-01 07:41:16.326777+00', '2026-02-01 07:41:16.326777+00', 'password', 'd579dd71-49b0-48d1-b2df-3eb02c8f4d85'),
	('a4025ed5-7282-481e-8440-096e61de70d0', '2026-02-01 07:51:48.973896+00', '2026-02-01 07:51:48.973896+00', 'password', '334ebdab-bf34-4fe4-b9c5-7d04ffd8b665'),
	('cf0f9fbb-c210-4b0d-a046-41580c831add', '2026-02-01 08:24:05.502195+00', '2026-02-01 08:24:05.502195+00', 'password', '44a34c77-d17b-4af0-b04c-f70b810ab2cb'),
	('0b4a7733-e1e6-49f7-81ae-894ae114e6ec', '2026-02-01 10:17:45.31562+00', '2026-02-01 10:17:45.31562+00', 'password', 'f2dca319-dd2c-484c-9199-f15ae78354e7'),
	('319f2982-dcc1-447f-9ac2-46eed2047394', '2026-02-01 15:31:31.489747+00', '2026-02-01 15:31:31.489747+00', 'password', '83cfd17e-6e63-40ac-a61c-87703f63187c'),
	('1c845058-1a78-4c09-ba60-abc4ae421775', '2026-02-01 16:44:32.528244+00', '2026-02-01 16:44:32.528244+00', 'password', '3529fb4a-3bc9-4ead-9053-ca500475db8c'),
	('e54de16c-b63e-4672-9abb-ba5cf9492999', '2026-02-02 07:25:40.627885+00', '2026-02-02 07:25:40.627885+00', 'password', '00e9c08f-cf56-4685-a37a-11a810dcbd8b'),
	('69f8f353-a534-4c9a-b457-7e59a4cda002', '2026-02-02 09:28:07.46541+00', '2026-02-02 09:28:07.46541+00', 'password', 'd8975f67-c58f-4e2c-a248-2fbc242306c3');


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") VALUES
	('00000000-0000-0000-0000-000000000000', 551, 'jgozcxzx5i37', '9bbeaa84-90d9-4064-a692-c58724a6228b', false, '2026-02-01 08:24:05.473934+00', '2026-02-01 08:24:05.473934+00', NULL, 'cf0f9fbb-c210-4b0d-a046-41580c831add'),
	('00000000-0000-0000-0000-000000000000', 554, 'nfgprseayveh', '9bbeaa84-90d9-4064-a692-c58724a6228b', false, '2026-02-01 11:16:38.4783+00', '2026-02-01 11:16:38.4783+00', 'foivjgt34ih2', '0b4a7733-e1e6-49f7-81ae-894ae114e6ec'),
	('00000000-0000-0000-0000-000000000000', 549, 'tyuinrv4mhnx', '9bbeaa84-90d9-4064-a692-c58724a6228b', true, '2026-02-01 07:41:16.271048+00', '2026-02-01 12:48:55.488373+00', NULL, 'b486fbf8-e40b-4c4b-b927-de53b5a9deb7'),
	('00000000-0000-0000-0000-000000000000', 556, 'zlfcre4rts7s', '9bbeaa84-90d9-4064-a692-c58724a6228b', true, '2026-02-01 12:48:55.508673+00', '2026-02-01 13:47:40.162062+00', 'tyuinrv4mhnx', 'b486fbf8-e40b-4c4b-b927-de53b5a9deb7'),
	('00000000-0000-0000-0000-000000000000', 558, 'p2dnaw4sglnc', '9bbeaa84-90d9-4064-a692-c58724a6228b', true, '2026-02-01 13:14:01.870004+00', '2026-02-01 14:17:47.194537+00', 'nxjrnvaavpsi', 'c2d5ccca-35bd-46aa-9076-dfeaaa64be9e'),
	('00000000-0000-0000-0000-000000000000', 560, 'ru6gewlnbeil', '9bbeaa84-90d9-4064-a692-c58724a6228b', true, '2026-02-01 14:17:47.214784+00', '2026-02-01 15:22:10.593975+00', 'p2dnaw4sglnc', 'c2d5ccca-35bd-46aa-9076-dfeaaa64be9e'),
	('00000000-0000-0000-0000-000000000000', 562, 'b54ej5gwywzm', '9bbeaa84-90d9-4064-a692-c58724a6228b', false, '2026-02-01 15:22:10.619959+00', '2026-02-01 15:22:10.619959+00', 'ru6gewlnbeil', 'c2d5ccca-35bd-46aa-9076-dfeaaa64be9e'),
	('00000000-0000-0000-0000-000000000000', 564, 'ez2h4eta67re', '9bbeaa84-90d9-4064-a692-c58724a6228b', true, '2026-02-01 15:47:03.095258+00', '2026-02-01 16:46:01.948328+00', 'xed5ijp25oiw', 'b486fbf8-e40b-4c4b-b927-de53b5a9deb7'),
	('00000000-0000-0000-0000-000000000000', 567, 'zhuikbixbw3k', '1d502b01-df8b-4f27-9965-fa550a5b4096', true, '2026-02-01 16:50:19.445972+00', '2026-02-01 17:56:58.157108+00', '53qw4jypzvxo', '319f2982-dcc1-447f-9ac2-46eed2047394'),
	('00000000-0000-0000-0000-000000000000', 570, 'vlrvawgnis5r', '1d502b01-df8b-4f27-9965-fa550a5b4096', false, '2026-02-01 17:56:58.170146+00', '2026-02-01 17:56:58.170146+00', 'zhuikbixbw3k', '319f2982-dcc1-447f-9ac2-46eed2047394'),
	('00000000-0000-0000-0000-000000000000', 572, 'frsrdazpjytj', '9bbeaa84-90d9-4064-a692-c58724a6228b', false, '2026-02-02 06:23:26.750265+00', '2026-02-02 06:23:26.750265+00', 'g2wfp3mgfkvu', 'a4025ed5-7282-481e-8440-096e61de70d0'),
	('00000000-0000-0000-0000-000000000000', 574, 'qqsp7lejzikr', '9bbeaa84-90d9-4064-a692-c58724a6228b', true, '2026-02-02 08:38:46.360863+00', '2026-02-02 09:37:58.320511+00', 'soma4y4y3s22', 'e54de16c-b63e-4672-9abb-ba5cf9492999'),
	('00000000-0000-0000-0000-000000000000', 576, '7lbw6fqxog3c', '9bbeaa84-90d9-4064-a692-c58724a6228b', false, '2026-02-02 09:37:58.334634+00', '2026-02-02 09:37:58.334634+00', 'qqsp7lejzikr', 'e54de16c-b63e-4672-9abb-ba5cf9492999'),
	('00000000-0000-0000-0000-000000000000', 546, 'pgiuayu2ynjf', '1d502b01-df8b-4f27-9965-fa550a5b4096', false, '2026-02-01 07:35:06.145007+00', '2026-02-01 07:35:06.145007+00', NULL, 'ad92e609-4065-4dc9-9388-66bc2c2dd0d8'),
	('00000000-0000-0000-0000-000000000000', 548, 'hfrbokxbnvxq', '9bbeaa84-90d9-4064-a692-c58724a6228b', true, '2026-02-01 07:37:26.976974+00', '2026-02-01 10:18:26.500104+00', NULL, 'c2d5ccca-35bd-46aa-9076-dfeaaa64be9e'),
	('00000000-0000-0000-0000-000000000000', 552, 'foivjgt34ih2', '9bbeaa84-90d9-4064-a692-c58724a6228b', true, '2026-02-01 10:17:45.293664+00', '2026-02-01 11:16:38.456718+00', NULL, '0b4a7733-e1e6-49f7-81ae-894ae114e6ec'),
	('00000000-0000-0000-0000-000000000000', 553, '5c6qigr2syvy', '9bbeaa84-90d9-4064-a692-c58724a6228b', true, '2026-02-01 10:18:26.503382+00', '2026-02-01 12:03:42.352618+00', 'hfrbokxbnvxq', 'c2d5ccca-35bd-46aa-9076-dfeaaa64be9e'),
	('00000000-0000-0000-0000-000000000000', 550, 'ajofyogso62p', '9bbeaa84-90d9-4064-a692-c58724a6228b', true, '2026-02-01 07:51:48.960066+00', '2026-02-01 13:03:41.186248+00', NULL, 'a4025ed5-7282-481e-8440-096e61de70d0'),
	('00000000-0000-0000-0000-000000000000', 555, 'nxjrnvaavpsi', '9bbeaa84-90d9-4064-a692-c58724a6228b', true, '2026-02-01 12:03:42.361097+00', '2026-02-01 13:14:01.857825+00', '5c6qigr2syvy', 'c2d5ccca-35bd-46aa-9076-dfeaaa64be9e'),
	('00000000-0000-0000-0000-000000000000', 559, 'f3arg3jhk7xa', '9bbeaa84-90d9-4064-a692-c58724a6228b', true, '2026-02-01 13:47:40.185235+00', '2026-02-01 14:48:47.534697+00', 'zlfcre4rts7s', 'b486fbf8-e40b-4c4b-b927-de53b5a9deb7'),
	('00000000-0000-0000-0000-000000000000', 561, 'xed5ijp25oiw', '9bbeaa84-90d9-4064-a692-c58724a6228b', true, '2026-02-01 14:48:47.550794+00', '2026-02-01 15:47:03.08007+00', 'f3arg3jhk7xa', 'b486fbf8-e40b-4c4b-b927-de53b5a9deb7'),
	('00000000-0000-0000-0000-000000000000', 563, '53qw4jypzvxo', '1d502b01-df8b-4f27-9965-fa550a5b4096', true, '2026-02-01 15:31:31.473641+00', '2026-02-01 16:50:19.443859+00', NULL, '319f2982-dcc1-447f-9ac2-46eed2047394'),
	('00000000-0000-0000-0000-000000000000', 565, 'gsdycrcpt2sb', '9bbeaa84-90d9-4064-a692-c58724a6228b', true, '2026-02-01 16:44:32.495111+00', '2026-02-01 17:43:04.614172+00', NULL, '1c845058-1a78-4c09-ba60-abc4ae421775'),
	('00000000-0000-0000-0000-000000000000', 568, 'wgkegn6hl2ud', '9bbeaa84-90d9-4064-a692-c58724a6228b', false, '2026-02-01 17:43:04.63194+00', '2026-02-01 17:43:04.63194+00', 'gsdycrcpt2sb', '1c845058-1a78-4c09-ba60-abc4ae421775'),
	('00000000-0000-0000-0000-000000000000', 566, 'wec34sql2cjh', '9bbeaa84-90d9-4064-a692-c58724a6228b', true, '2026-02-01 16:46:01.951642+00', '2026-02-01 17:44:34.817691+00', 'ez2h4eta67re', 'b486fbf8-e40b-4c4b-b927-de53b5a9deb7'),
	('00000000-0000-0000-0000-000000000000', 569, 'en3brudkitcl', '9bbeaa84-90d9-4064-a692-c58724a6228b', false, '2026-02-01 17:44:34.833696+00', '2026-02-01 17:44:34.833696+00', 'wec34sql2cjh', 'b486fbf8-e40b-4c4b-b927-de53b5a9deb7'),
	('00000000-0000-0000-0000-000000000000', 557, 'ahsfd7i6la7i', '9bbeaa84-90d9-4064-a692-c58724a6228b', true, '2026-02-01 13:03:41.209187+00', '2026-02-02 05:24:30.628841+00', 'ajofyogso62p', 'a4025ed5-7282-481e-8440-096e61de70d0'),
	('00000000-0000-0000-0000-000000000000', 571, 'g2wfp3mgfkvu', '9bbeaa84-90d9-4064-a692-c58724a6228b', true, '2026-02-02 05:24:30.65421+00', '2026-02-02 06:23:26.712939+00', 'ahsfd7i6la7i', 'a4025ed5-7282-481e-8440-096e61de70d0'),
	('00000000-0000-0000-0000-000000000000', 573, 'soma4y4y3s22', '9bbeaa84-90d9-4064-a692-c58724a6228b', true, '2026-02-02 07:25:40.608236+00', '2026-02-02 08:38:46.330763+00', NULL, 'e54de16c-b63e-4672-9abb-ba5cf9492999'),
	('00000000-0000-0000-0000-000000000000', 575, 'xcnsmyj7oryq', '1d502b01-df8b-4f27-9965-fa550a5b4096', false, '2026-02-02 09:28:07.448421+00', '2026-02-02 09:28:07.448421+00', NULL, '69f8f353-a534-4c9a-b457-7e59a4cda002');


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: app_modules; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."app_modules" ("id", "name", "description", "category", "is_basic", "created_at", "updated_at") VALUES
	('images', 'Hình ảnh', 'Quản lý hình ảnh đại diện sản phẩm', 'product', true, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('pricing', 'Giá cả', 'Thiết lập giá vốn, giá bán lẻ, giá bán buôn', 'product', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('packaging', 'Quy cách đóng gói', 'Ghi chú quy cách đóng gói', 'product', true, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('inbound_basic', 'Thông tin cơ bản (Mặc định)', 'Mã phiếu, Kho nhập, Ngày tạo, Diễn giải', 'inbound', true, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('inbound_type', 'Phân loại phiếu', 'Chọn loại phiếu nhập (từ SX, NCC, Chuyển kho...)', 'inbound', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('inbound_financials', 'Tài chính & Thuế', 'Đơn giá, Thành tiền, Chiết khấu, VAT', 'inbound', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('inbound_documents', 'Chứng từ kèm theo', 'Số hóa đơn, Số phiếu giao hàng, Chứng từ gốc', 'inbound', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('inbound_logistics', 'Vận chuyển & Kho bãi', 'Biển số xe, Tên tài xế, Vị trí kho nhập', 'inbound', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('inbound_images', 'Hình ảnh hóa đơn', 'Chụp hoặc tải lên ảnh hóa đơn, chứng từ', 'inbound', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('inbound_accounting', 'Hạch toán Kế toán', 'Tài khoản Nợ/Có, Diễn giải hạch toán', 'inbound', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('inbound_ui_compact', 'Giao diện thu gọn', 'Sử dụng màn hình tạo phiếu nhỏ hơn (Compact Mode)', 'inbound', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('inbound_conversion', 'Quy đổi đơn vị', 'Hiển thị cột quy đổi số lượng theo đơn vị đích (VD: Thùng -> Kg)', 'inbound', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('outbound_basic', 'Thông tin cơ bản (Mặc định)', 'Mã phiếu, Kho xuất, Diễn giải', 'outbound', true, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('outbound_type', 'Phân loại phiếu', 'Chọn loại phiếu xuất (Xuất bán, Hủy, Chuyển kho...)', 'outbound', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('outbound_financials', 'Tài chính & Doanh thu', 'Đơn giá, Tổng tiền, Chiết khấu thương mại, Thuế', 'outbound', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('outbound_images', 'Hình ảnh chứng từ', 'Chụp hoặc tải lên ảnh phiếu xuất, biên bản', 'outbound', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('outbound_logistics', 'Giao nhận & Vận chuyển', 'Địa điểm giao hàng, Phương thức vận chuyển, Người nhận', 'outbound', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('outbound_documents', 'Chứng từ xuất kho', 'Lệnh xuất kho, Hợp đồng kinh tế', 'outbound', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('outbound_accounting', 'Hạch toán Kế toán', 'Tài khoản Nợ/Có, Doanh thu, giá vốn', 'outbound', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('outbound_ui_compact', 'Giao diện thu gọn', 'Sử dụng màn hình tạo phiếu nhỏ hơn (Compact Mode)', 'outbound', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('outbound_conversion', 'Quy đổi đơn vị', 'Hiển thị cột quy đổi số lượng theo đơn vị đích (VD: Thùng -> Kg)', 'outbound', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('packaging_date', 'Ngày đóng bao bì', 'Hiển thị trường nhập và thời gian đóng gói bao bì.', 'lot', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('warehouse_name', 'Kho nhập hàng', 'Hiển thị và cho phép chọn kho nhập hàng (chi nhánh).', 'lot', true, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('peeling_date', 'Ngày bóc múi', 'Hiển thị trường ngày bóc múi.', 'lot', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('batch_code', 'Số Batch/Lô (NCC)', 'Hiển thị trường nhập số Batch hoặc Lô của nhà cung cấp.', 'lot', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('supplier_info', 'Nhà cung cấp', 'Hiển thị và cho phép chọn nhà cung cấp.', 'lot', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('qc_info', 'Nhân viên QC', 'Hiển thị và cho phép chọn nhân viên kiểm soát chất lượng.', 'lot', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('inbound_date', 'Ngày nhập kho', 'Hiển thị trường ngày nhập kho.', 'lot', true, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('lot_images', 'Hình ảnh chứng từ / LOT', 'Cho phép tải lên và hiển thị hình ảnh của LOT.', 'lot', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('extra_info', 'Thông tin phụ', 'Trường nhập các thông tin bổ sung khác cho LOT.', 'lot', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('stats_overview', 'Thẻ thống kê tổng quan', 'Hiển thị tổng sản phẩm, danh mục, tồn kho thấp và nhập hàng trong tuần.', 'dashboard', true, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('inventory_distribution', 'Tỉ lệ phân bố hàng hóa', 'Biểu đồ tròn hiển thị tỉ lệ phần trăm các loại hàng hóa trong kho.', 'dashboard', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('categories_summary', 'Danh sách danh mục', 'Bảng tóm tắt các danh mục sản phẩm hiện có.', 'dashboard', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('recent_products', 'Sản phẩm mới nhất', 'Danh sách các sản phẩm mới được thêm vào hệ thống.', 'dashboard', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('lot_accounting_sync', 'Đồng bộ Kho - Kế toán (LOT)', 'Tự động tạo hàng chờ nhập/xuất và đồng bộ dữ liệu chênh lệch khi thay đổi LOT.', 'utility', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('auto_unbundle_order', 'Bẻ gói Kế toán (PNK/PXK)', 'Tự động tạo phiếu chuyển đổi (AUTO) khi xuất hàng lẻ đơn vị (ví dụ: bẻ Bao thành Gói).', 'utility', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('auto_unbundle_lot', 'Bẻ gói Kho (LOT/Vị trí)', 'Cho phép thực hiện thao tác chia tách LOT và bẻ đơn vị tính trực tiếp tại sơ đồ kho.', 'utility', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('site_inventory_manager', 'Quản lý Cấp Phát Công Trình', 'Theo dõi xuất vật tư tiêu hao theo tổ đội và sổ theo dõi mượn/trả công cụ dụng cụ.', 'utility', false, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('inbound_supplier', 'Thông tin Nhà cung cấp', 'Tên NCC, Địa chỉ, Số điện thoại liên hệ', 'inbound', true, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00'),
	('outbound_customer', 'Thông tin Khách hàng', 'Khách hàng, Địa chỉ, Số điện thoại', 'outbound', true, '2026-01-31 13:57:21.205825+00', '2026-01-31 13:57:21.205825+00');


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."audit_logs" ("id", "table_name", "record_id", "action", "old_data", "new_data", "changed_by", "created_at", "system_code") VALUES
	('5d91e786-53d7-407b-9818-153828e40e48', 'lots', '5017465c-3620-4ecc-afa7-a78ee00e9b10', 'CREATE', NULL, '{"code": "DL-LOT-010226-005", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 26, "lot_items": [{"unit": "Thùng", "quantity": 26, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-01-31", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 12:49:15.118334+00', 'KHO_DONG_LANH'),
	('0f8bb566-b06e-43ff-a733-09395bdc837e', 'lots', 'e594de78-19fe-4397-b37f-180c39a7b10b', 'CREATE', NULL, '{"code": "DL-LOT-010226-008", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-01-31", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 14:20:00.503745+00', 'KHO_DONG_LANH'),
	('d077307f-79ea-45fb-af2e-da5c413913b7', 'lots', 'f8a35aef-de0a-43fa-a461-29464d88007e', 'CREATE', NULL, '{"code": "DL-LOT-010226-018", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-01-31", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 14:55:35.887566+00', 'KHO_DONG_LANH'),
	('221b65aa-0446-4555-b5b5-f509a1062ab3', 'lots', '843db159-185d-4d86-aa05-4efae82553a3', 'CREATE', NULL, '{"code": "DL-LOT-020226-005", "notes": "", "qc_id": null, "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 35, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}, {"unit": "Kg", "quantity": 10, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-02-01", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 17:29:14.474382+00', 'KHO_DONG_LANH'),
	('1797a869-9eb0-48ae-ae0c-d3274adf4d1b', 'lots', 'aba93acc-73be-47e1-b0d0-6a2babb4d0bb', 'UPDATE', '{"id": "aba93acc-73be-47e1-b0d0-6a2babb4d0bb", "code": "DL-LOT-020226-013", "notes": "", "qc_id": null, "images": [], "status": "active", "qc_info": null, "lot_tags": [], "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "products": null, "quantity": 0, "lot_items": [], "positions": [], "suppliers": null, "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "created_at": "2026-02-02T09:17:07.139075+00:00", "product_id": null, "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-02", "peeling_date": "2026-02-02T00:00:00+00:00", "packaging_date": "2026-02-02", "warehouse_name": "CN Đắk Lắk"}', '{"code": "DL-LOT-020226-013", "notes": "", "qc_id": null, "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-02", "peeling_date": "2026-02-02", "packaging_date": "2026-02-02", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-02 09:18:03.239884+00', 'KHO_DONG_LANH'),
	('be165d2a-2a56-49e1-8d83-1eed5db6fa21', 'user_profiles', '8560fd3f-170f-4c54-bba8-86cf8ea09699', 'CREATE', NULL, '{"email": "tabc.thukho@system.local", "username": "tabc.thukho", "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 05:42:02.221618+00', NULL),
	('f3102bb2-0679-4755-82f2-9045cb980a32', 'lots', 'd5a6b839-cc62-4e06-a45d-fb316eeb6230', 'CREATE', NULL, '{"code": "DL-LOT-010226-001", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 22, "lot_items": [{"unit": "Thùng", "quantity": 22, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-01-31", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 13:49:28.434966+00', 'KHO_DONG_LANH'),
	('7a17fd02-a0ad-4246-8171-a1a6d1055950', 'lots', '8f854631-1ebf-4719-993c-71f1824e0ff7', 'CREATE', NULL, '{"code": "DL-LOT-010226-009", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-01-31", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 14:27:07.827559+00', 'KHO_DONG_LANH'),
	('2697483e-75e8-4cad-a03d-03722edbd752', 'lots', '1b03b413-1eeb-42f4-9499-68abbe8f6f92', 'CREATE', NULL, '{"code": "DL-LOT-010226-019", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-01-31", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 15:01:06.003418+00', 'KHO_DONG_LANH'),
	('d0fa02be-2478-44bd-ae77-25e4024741d5', 'lots', 'dcd78784-c6a5-44f6-a22f-abf4e1ae59ef', 'CREATE', NULL, '{"code": "DL-LOT-020226-006", "notes": "", "qc_id": null, "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Kg", "quantity": 25, "productId": "6cbf26a4-a91a-4bcc-b033-e3c46373df63"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-02-01", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 17:44:07.196931+00', 'KHO_DONG_LANH'),
	('476ca96d-facd-4741-9bc1-54d60199a29f', 'lots', 'dbc042e3-c68a-40cb-93d5-87e4389598d0', 'CREATE', NULL, '{"code": "DL-LOT-020226-014", "notes": "", "qc_id": null, "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 0, "lot_items": [], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-02", "peeling_date": "2026-02-02", "packaging_date": "2026-02-02", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-02 09:24:04.165927+00', 'KHO_DONG_LANH'),
	('f548f99c-5f3d-4bc7-a502-3eb18c5dc329', 'user_profiles', 'a0ad4b7a-e0e5-42a0-bb06-4aa2b07c0018', 'CREATE', NULL, '{"email": "tabc.thukho2@system.local", "username": "tabc.thukho2", "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 06:25:09.420674+00', NULL),
	('3b8123c2-6b84-411f-8ad0-c41775ae2fa7', 'lots', '67bcf01d-9cbb-4a9b-aab1-54d5320eff4d', 'CREATE', NULL, '{"code": "DL-LOT-010226-002", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 23, "lot_items": [{"unit": "Thùng", "quantity": 23, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-01-31", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 13:49:37.02826+00', 'KHO_DONG_LANH'),
	('8372a840-a608-425a-af1c-c9db305f8395', 'lots', '6b1ecc63-2679-4f54-979b-b20fc128728e', 'CREATE', NULL, '{"code": "DL-LOT-010226-010", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-01-31", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 14:28:52.453958+00', 'KHO_DONG_LANH'),
	('d66473cf-5db2-459e-a593-9ad19d7a6ebd', 'lots', 'a1933cf4-ecdf-46b7-8fd2-0044e2ed97cc', 'CREATE', NULL, '{"code": "DL-LOT-010226-011", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-01-31", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 14:28:58.265011+00', 'KHO_DONG_LANH'),
	('2011145c-33d8-45d6-9271-f160311db386', 'lots', 'c47ff623-db9d-4470-9586-38b6913fb22b', 'CREATE', NULL, '{"code": "DL-LOT-010226-020", "notes": "", "qc_id": null, "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 0, "lot_items": [], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-02-01", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 16:45:46.916204+00', 'KHO_DONG_LANH'),
	('ae5a7343-1048-4e71-b5f7-3a6c12c587d0', 'lots', '03da8a12-3ac9-497a-9cd8-e3a5b86605a6', 'CREATE', NULL, '{"code": "DL-LOT-020226-007", "notes": "", "qc_id": null, "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Kg", "quantity": 25, "productId": "124c83ea-9077-41e6-be89-d071bccebc02"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-02-01", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 17:44:19.154424+00', 'KHO_DONG_LANH'),
	('aababf03-de55-4fab-b3e7-17f8c67ba063', 'lots', 'dbc042e3-c68a-40cb-93d5-87e4389598d0', 'UPDATE', '{"id": "dbc042e3-c68a-40cb-93d5-87e4389598d0", "code": "DL-LOT-020226-014", "notes": "", "qc_id": null, "images": [], "status": "active", "qc_info": null, "lot_tags": [], "metadata": {"extra_info": "", "system_history": {"edits": [{"id": "c07f478d-a83f-41f8-8c6a-ca413950dff1", "date": "2026-02-02T09:24:20.664Z", "actor": "HTX Trái Cây ABC", "description": "Cập nhật thông tin lô hàng"}], "exports": [], "inbound": []}}, "products": null, "quantity": 0, "lot_items": [], "positions": [], "suppliers": null, "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "created_at": "2026-02-02T09:24:03.883823+00:00", "product_id": null, "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-02", "peeling_date": "2026-02-02T00:00:00+00:00", "packaging_date": "2026-02-02", "warehouse_name": "CN Đắk Lắk"}', '{"code": "DL-LOT-020226-014", "notes": "", "qc_id": null, "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"edits": [{"id": "c07f478d-a83f-41f8-8c6a-ca413950dff1", "date": "2026-02-02T09:24:20.664Z", "actor": "HTX Trái Cây ABC", "description": "Cập nhật thông tin lô hàng"}], "exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-02", "peeling_date": "2026-02-02", "packaging_date": "2026-02-02", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-02 09:24:21.968684+00', 'KHO_DONG_LANH'),
	('7b0e3f10-1cf9-476e-8d3f-6ff14782e72b', 'qc_info', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'CREATE', NULL, '{"id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "code": "ĐL-QC01", "name": "Cúc", "is_active": true, "company_id": null, "created_at": "2026-02-01T06:45:01.440647+00:00", "updated_at": "2026-02-01T06:45:01.440647+00:00", "description": "", "system_code": "KHO_DONG_LANH"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 06:45:01.919839+00', 'KHO_DONG_LANH'),
	('c34a8429-390a-40f7-9837-03b2b7764694', 'lots', '6cb14875-edc2-487a-aa89-8e7775ccf85a', 'CREATE', NULL, '{"code": "DL-LOT-010226-003", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 24, "lot_items": [{"unit": "Thùng", "quantity": 24, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-01-31", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 13:49:44.49344+00', 'KHO_DONG_LANH'),
	('334c86a7-6525-4ce7-965e-52b3adabb0df', 'lots', 'd760a75b-895e-4238-bc25-02e6d75b03fc', 'CREATE', NULL, '{"code": "DL-LOT-010226-012", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-01-31", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 14:37:56.539006+00', 'KHO_DONG_LANH'),
	('1dd674e9-9a3f-4f1f-8572-478f92a33320', 'lots', '9bff788c-1a44-4111-916a-f0ee44c7c1bf', 'CREATE', NULL, '{"code": "DL-LOT-010226-013", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-01-31", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 14:38:02.767859+00', 'KHO_DONG_LANH'),
	('57449bd8-faa3-424e-a412-bee593a98def', 'lots', 'a441f57c-e092-4460-b9de-328ef58a9197', 'CREATE', NULL, '{"code": "DL-LOT-020226-001", "notes": "", "qc_id": null, "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-02-01", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 17:23:01.380983+00', 'KHO_DONG_LANH'),
	('46801e73-8cf3-43ad-914f-d3d5ca4b8c9d', 'lots', '0ec26979-bd42-46da-9703-163d1202135b', 'CREATE', NULL, '{"code": "DL-LOT-020226-008", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "KD/BB2", "system_history": {"exports": [], "inbound": []}}, "quantity": 50, "lot_items": [{"unit": "Kg", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}, {"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-01-26", "peeling_date": "2026-02-01", "packaging_date": "2026-02-02", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-02 05:25:58.999732+00', 'KHO_DONG_LANH'),
	('e75f68c5-88a4-4fcd-902d-eac11683e77d', 'lots', '2d88825d-b77c-4eb8-b07e-30caa181885c', 'CREATE', NULL, '{"code": "DL-LOT-020226-009", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "KD/BB2", "system_history": {"exports": [], "inbound": []}}, "quantity": 50, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "6cbf26a4-a91a-4bcc-b033-e3c46373df63"}, {"unit": "Kg", "quantity": 25, "productId": "6cbf26a4-a91a-4bcc-b033-e3c46373df63"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-01-26", "peeling_date": "2026-02-01", "packaging_date": "2026-02-02", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-02 05:26:15.642441+00', 'KHO_DONG_LANH'),
	('4b7ae29f-c030-46ae-ab25-2e50af7fe8d8', 'lots', 'e6cd4f5f-6190-49fb-b33b-fa97ce87121d', 'CREATE', NULL, '{"code": "DL-LOT-020226-010", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "KD/BB2", "system_history": {"exports": [], "inbound": []}}, "quantity": 50, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "124c83ea-9077-41e6-be89-d071bccebc02"}, {"unit": "Kg", "quantity": 25, "productId": "124c83ea-9077-41e6-be89-d071bccebc02"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-01-26", "peeling_date": "2026-02-01", "packaging_date": "2026-02-02", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-02 05:26:41.787767+00', 'KHO_DONG_LANH'),
	('86a88084-e141-46f7-a2e5-978126247142', 'lots', '98044d5d-6207-4bef-b31f-7ea2ed989de7', 'CREATE', NULL, '{"code": "DL-LOT-020226-015", "notes": "", "qc_id": null, "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": [{"id": "5f812dc0-5eac-4699-9259-0242b6ad2a7a", "date": "2026-02-02T09:29:06.424Z", "draft": true, "items": {}, "supplier_id": null, "supplier_name": "N/A"}]}}, "quantity": 0, "lot_items": [], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-02", "peeling_date": "2026-02-02", "packaging_date": "2026-02-02", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-02 09:29:06.792032+00', 'KHO_DONG_LANH'),
	('49d79304-8bf4-4e52-a965-d9b2cafb89d2', 'lots', 'bd8fe291-38af-4d33-a2f8-68f0b33d160a', 'CREATE', NULL, '{"code": "DL-LOT-010226-001", "notes": "test", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "K1-A2-A", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-02-01", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 06:46:37.749943+00', 'KHO_DONG_LANH'),
	('93c686d2-afdf-4168-9a66-71c55456814c', 'lots', '3e9ba386-e16e-447c-80d4-1c9af4db7c8b', 'CREATE', NULL, '{"code": "DL-LOT-010226-004", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-01-31", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 13:59:56.107842+00', 'KHO_DONG_LANH'),
	('52483fbf-2f54-449d-a35e-3a137b4af3e2', 'lots', '64245054-e66a-4b06-a6d6-bd936ca5db0a', 'CREATE', NULL, '{"code": "DL-LOT-010226-014", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-01-31", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 14:39:46.012101+00', 'KHO_DONG_LANH'),
	('43747d3f-7bd7-4bff-bf61-ce839b0ad2df', 'lots', '178c8352-9fe5-48f9-8cd5-650d4ac43e24', 'CREATE', NULL, '{"code": "DL-LOT-020226-002", "notes": "", "qc_id": null, "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-02-01", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 17:23:13.182429+00', 'KHO_DONG_LANH'),
	('8fe4a8c0-9650-4e04-bda7-1fa9db8bbc07', 'lots', '2730183b-e4ca-4512-8d89-0e12468cfa96', 'CREATE', NULL, '{"code": "DL-LOT-020226-011", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "KD/BB3", "system_history": {"exports": [], "inbound": []}}, "quantity": 50, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "124c83ea-9077-41e6-be89-d071bccebc02"}, {"unit": "Kg", "quantity": 25, "productId": "124c83ea-9077-41e6-be89-d071bccebc02"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-01-26", "peeling_date": "2026-02-01", "packaging_date": "2026-02-02", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-02 07:09:22.259268+00', 'KHO_DONG_LANH'),
	('fa247d0e-bcf6-4d8d-9c8b-cf2dfdfcd3de', 'lots', '98044d5d-6207-4bef-b31f-7ea2ed989de7', 'UPDATE', '{"id": "98044d5d-6207-4bef-b31f-7ea2ed989de7", "code": "DL-LOT-020226-015", "notes": "", "qc_id": null, "images": [], "status": "active", "qc_info": null, "lot_tags": [], "metadata": {"extra_info": "", "system_history": {"edits": [{"id": "39f84b47-99c7-4b13-b384-e065a503450f", "date": "2026-02-02T09:29:47.480Z", "actor": "HTX Trái Cây ABC", "description": "Cập nhật thông tin lô hàng"}], "exports": [], "inbound": [{"id": "5f812dc0-5eac-4699-9259-0242b6ad2a7a", "date": "2026-02-02T09:29:06.424Z", "draft": true, "items": {"0": {"unit": "Thùng", "price": 0, "quantity": 25, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A"}}, "is_edit": true, "updated_at": "2026-02-02T09:29:47.480Z", "supplier_id": null, "supplier_name": "N/A"}]}}, "products": null, "quantity": 0, "lot_items": [], "positions": [], "suppliers": null, "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "created_at": "2026-02-02T09:29:06.535344+00:00", "product_id": null, "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-02", "peeling_date": "2026-02-02T00:00:00+00:00", "packaging_date": "2026-02-02", "warehouse_name": "CN Đắk Lắk"}', '{"code": "DL-LOT-020226-015", "notes": "", "qc_id": null, "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"edits": [{"id": "39f84b47-99c7-4b13-b384-e065a503450f", "date": "2026-02-02T09:29:47.480Z", "actor": "HTX Trái Cây ABC", "description": "Cập nhật thông tin lô hàng"}], "exports": [], "inbound": [{"id": "5f812dc0-5eac-4699-9259-0242b6ad2a7a", "date": "2026-02-02T09:29:06.424Z", "draft": true, "items": {"0": {"unit": "Thùng", "price": 0, "quantity": 25, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A"}}, "is_edit": true, "updated_at": "2026-02-02T09:29:47.480Z", "supplier_id": null, "supplier_name": "N/A"}]}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-02", "peeling_date": "2026-02-02", "packaging_date": "2026-02-02", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-02 09:29:48.734822+00', 'KHO_DONG_LANH'),
	('27223dad-324c-4ade-ac24-11686384290c', 'lots', 'b49ee940-35a6-45ed-943d-c04566660b4a', 'CREATE', NULL, '{"code": "DL-LOT-010226-002", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 26, "lot_items": [{"unit": "Thùng", "quantity": 26, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-01-31", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 07:43:44.452942+00', 'KHO_DONG_LANH'),
	('4f5de653-77a4-4af7-8c9d-b51f633dc058', 'lots', 'b7c760a5-9720-46f9-bc55-955d5143e462', 'CREATE', NULL, '{"code": "DL-LOT-010226-005", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-01-31", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 14:01:04.622674+00', 'KHO_DONG_LANH'),
	('43c77dd8-743e-4d89-933c-9881ab80ead5', 'lots', '86b9d199-0547-4112-bb3c-b0f231f96664', 'CREATE', NULL, '{"code": "DL-LOT-010226-015", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-01-31", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 14:49:09.496863+00', 'KHO_DONG_LANH'),
	('8a718ad7-a8b9-45a0-9290-fada396bc1b1', 'lots', 'a441f57c-e092-4460-b9de-328ef58a9197', 'UPDATE', '{"id": "a441f57c-e092-4460-b9de-328ef58a9197", "code": "DL-LOT-020226-001", "notes": "", "qc_id": null, "images": [], "status": "active", "qc_info": null, "lot_tags": [], "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "products": null, "quantity": 25, "lot_items": [{"id": "13e761ee-91e4-4a3f-bbb5-9a38d7535ba7", "unit": "Thùng", "products": {"sku": "TA", "name": "Sầu Riêng A", "unit": "Kg", "cost_price": 0, "product_code": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}, "quantity": 25, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "positions": [{"code": "S.VT1"}], "suppliers": null, "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "created_at": "2026-02-01T17:23:01.078479+00:00", "product_id": null, "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-02-01T00:00:00+00:00", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '{"code": "DL-LOT-020226-001", "notes": "", "qc_id": null, "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 35, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}, {"unit": "Kg", "quantity": 10, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-02-01", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 17:25:52.754664+00', 'KHO_DONG_LANH'),
	('8b677f8e-cbf7-44e3-90d4-f51209159c29', 'lots', 'c47ff623-db9d-4470-9586-38b6913fb22b', 'UPDATE', '{"id": "c47ff623-db9d-4470-9586-38b6913fb22b", "code": "DL-LOT-010226-020", "notes": "", "qc_id": null, "images": [], "status": "active", "qc_info": null, "lot_tags": [], "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "products": null, "quantity": 0, "lot_items": [], "positions": [], "suppliers": null, "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "created_at": "2026-02-01T16:45:46.667284+00:00", "product_id": null, "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-02-01T00:00:00+00:00", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '{"code": "DL-LOT-010226-020", "notes": "", "qc_id": null, "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-02-01", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-02 09:14:18.337521+00', 'KHO_DONG_LANH'),
	('c53ebd5c-93f0-45e3-8643-fe4efd9814a2', 'lots', '98044d5d-6207-4bef-b31f-7ea2ed989de7', 'UPDATE', '{"id": "98044d5d-6207-4bef-b31f-7ea2ed989de7", "code": "DL-LOT-020226-015", "notes": "", "qc_id": null, "images": [], "status": "active", "qc_info": null, "lot_tags": [], "metadata": {"extra_info": "", "system_history": {"edits": [{"id": "39f84b47-99c7-4b13-b384-e065a503450f", "date": "2026-02-02T09:29:47.480Z", "actor": "HTX Trái Cây ABC", "description": "Cập nhật thông tin lô hàng"}, {"id": "ddbfb04d-efbe-4466-8c23-180c3693c7f5", "date": "2026-02-02T09:31:37.024Z", "actor": "HTX Trái Cây ABC", "description": "Cập nhật thông tin lô hàng"}], "exports": [], "inbound": [{"id": "5f812dc0-5eac-4699-9259-0242b6ad2a7a", "date": "2026-02-02T09:29:06.424Z", "draft": false, "items": {"0": {"unit": "Thùng", "price": 0, "quantity": 25, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A"}}, "is_edit": true, "order_id": "bb4574c6-a34d-4432-b732-fd624e2b756e", "order_code": "DL-PNK-020226-001", "updated_at": "2026-02-02T09:29:47.480Z", "supplier_id": null, "supplier_name": "N/A"}, {"id": "49f14903-2233-4f21-bd50-2169113c948a", "date": "2026-02-02T09:31:37.024Z", "draft": true, "items": {"0": {"unit": "Thùng", "price": 0, "quantity": 2, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A"}}, "is_edit": true, "description": "Điều chỉnh số lượng LOT DL-LOT-020226-015", "supplier_id": null, "is_adjustment": true, "supplier_name": "N/A"}]}}, "products": null, "quantity": 25, "lot_items": [{"id": "6ab9f7a3-1792-4f20-ae9a-bf01d0035012", "unit": "Thùng", "products": {"sku": "TA", "name": "Sầu Riêng A", "unit": "Kg", "cost_price": 0, "product_code": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}, "quantity": 25, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "positions": [], "suppliers": null, "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "created_at": "2026-02-02T09:29:06.535344+00:00", "product_id": null, "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-02", "peeling_date": "2026-02-02T00:00:00+00:00", "packaging_date": "2026-02-02", "warehouse_name": "CN Đắk Lắk"}', '{"code": "DL-LOT-020226-015", "notes": "", "qc_id": null, "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"edits": [{"id": "39f84b47-99c7-4b13-b384-e065a503450f", "date": "2026-02-02T09:29:47.480Z", "actor": "HTX Trái Cây ABC", "description": "Cập nhật thông tin lô hàng"}, {"id": "ddbfb04d-efbe-4466-8c23-180c3693c7f5", "date": "2026-02-02T09:31:37.024Z", "actor": "HTX Trái Cây ABC", "description": "Cập nhật thông tin lô hàng"}], "exports": [], "inbound": [{"id": "5f812dc0-5eac-4699-9259-0242b6ad2a7a", "date": "2026-02-02T09:29:06.424Z", "draft": false, "items": {"0": {"unit": "Thùng", "price": 0, "quantity": 25, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A"}}, "is_edit": true, "order_id": "bb4574c6-a34d-4432-b732-fd624e2b756e", "order_code": "DL-PNK-020226-001", "updated_at": "2026-02-02T09:29:47.480Z", "supplier_id": null, "supplier_name": "N/A"}, {"id": "49f14903-2233-4f21-bd50-2169113c948a", "date": "2026-02-02T09:31:37.024Z", "draft": true, "items": {"0": {"unit": "Thùng", "price": 0, "quantity": 2, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A"}}, "is_edit": true, "description": "Điều chỉnh số lượng LOT DL-LOT-020226-015", "supplier_id": null, "is_adjustment": true, "supplier_name": "N/A"}]}}, "quantity": 27, "lot_items": [{"unit": "Thùng", "quantity": 27, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-02", "peeling_date": "2026-02-02", "packaging_date": "2026-02-02", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-02 09:31:38.735259+00', 'KHO_DONG_LANH'),
	('25483fbf-11d9-4b86-b3f0-a28cf40782a9', 'lots', 'ece2fd09-0c8d-4c53-ab36-e5bf4c8b8653', 'CREATE', NULL, '{"code": "DL-LOT-010226-003", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 26, "lot_items": [{"unit": "Thùng", "quantity": 26, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-01-31", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 07:43:53.41799+00', 'KHO_DONG_LANH'),
	('02bed807-7790-4d3e-947c-fc1ce66d6d49', 'lots', '16f1841b-839a-45a6-a5d2-d29ada0f837d', 'CREATE', NULL, '{"code": "DL-LOT-010226-006", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-01-31", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 14:07:20.847124+00', 'KHO_DONG_LANH'),
	('f0cf462a-f8bc-43a4-b1d9-cdb75fcf43ec', 'lots', '722f6ea2-8a25-4dfc-a4c4-0cce6f14749b', 'CREATE', NULL, '{"code": "DL-LOT-010226-016", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-01-31", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 14:52:37.936604+00', 'KHO_DONG_LANH'),
	('bc7f5ebe-ddff-4e35-b003-1e14083b6abd', 'lots', '215c7ed9-7ac5-4262-86d6-ec8cd1f0ebc9', 'CREATE', NULL, '{"code": "DL-LOT-020226-003", "notes": "", "qc_id": null, "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-02-01", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 17:26:02.243337+00', 'KHO_DONG_LANH'),
	('257a5d90-6706-4c50-9287-4525993d65dc', 'lots', '374256f3-599e-45df-aaaf-d7e3ce01fdb7', 'CREATE', NULL, '{"code": "DL-LOT-020226-012", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "KD/1/2", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "124c83ea-9077-41e6-be89-d071bccebc02"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-01-27", "peeling_date": "2026-01-25", "packaging_date": "2026-01-27", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-02 09:16:49.011059+00', 'KHO_DONG_LANH'),
	('1c5bdac8-d23f-4a2a-8037-793a5dbed9d0', 'lots', '98044d5d-6207-4bef-b31f-7ea2ed989de7', 'UPDATE', '{"id": "98044d5d-6207-4bef-b31f-7ea2ed989de7", "code": "DL-LOT-020226-015", "notes": "", "qc_id": null, "images": [], "status": "active", "qc_info": null, "lot_tags": [], "metadata": {"extra_info": "", "system_history": {"edits": [{"id": "39f84b47-99c7-4b13-b384-e065a503450f", "date": "2026-02-02T09:29:47.480Z", "actor": "HTX Trái Cây ABC", "description": "Cập nhật thông tin lô hàng"}, {"id": "ddbfb04d-efbe-4466-8c23-180c3693c7f5", "date": "2026-02-02T09:31:37.024Z", "actor": "HTX Trái Cây ABC", "description": "Cập nhật thông tin lô hàng"}, {"id": "83917f35-f49d-4da6-8f29-b0f0aabc73d2", "date": "2026-02-02T09:34:38.881Z", "actor": "HTX Trái Cây ABC", "changes": ["Nhà cung cấp: N/A → N/A", "QC: N/A → N/A", "Batch NCC: N/A → N/A", "Tổng SL: 27 → 20"], "description": "Cập nhật thông tin lô hàng"}], "exports": [{"id": "ac41b07b-a0d2-435b-814c-c93aff24ad0c", "date": "2026-02-02T09:34:38.881Z", "draft": true, "items": {"0": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 7}}, "is_edit": true, "customer": "Hệ thống (Điều chỉnh)", "description": "Điều chỉnh số lượng LOT DL-LOT-020226-015", "is_adjustment": true, "location_code": "CN Đắk Lắk"}], "inbound": [{"id": "5f812dc0-5eac-4699-9259-0242b6ad2a7a", "date": "2026-02-02T09:29:06.424Z", "draft": false, "items": {"0": {"unit": "Thùng", "price": 0, "quantity": 25, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A"}}, "is_edit": true, "order_id": "bb4574c6-a34d-4432-b732-fd624e2b756e", "order_code": "DL-PNK-020226-001", "updated_at": "2026-02-02T09:29:47.480Z", "supplier_id": null, "supplier_name": "N/A"}, {"id": "49f14903-2233-4f21-bd50-2169113c948a", "date": "2026-02-02T09:31:37.024Z", "draft": false, "items": {"0": {"unit": "Thùng", "price": 0, "quantity": 2, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A"}}, "is_edit": true, "order_id": "f763cece-0417-4cd7-9eb8-0bfe9ed5e13b", "order_code": "DL-PNK-020226-002", "description": "Điều chỉnh số lượng LOT DL-LOT-020226-015", "supplier_id": null, "is_adjustment": true, "supplier_name": "N/A"}]}}, "products": null, "quantity": 27, "lot_items": [{"id": "98183a32-0476-4179-8440-6eaaec8d3f9a", "unit": "Thùng", "products": {"sku": "TA", "name": "Sầu Riêng A", "unit": "Kg", "cost_price": 0, "product_code": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}, "quantity": 27, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "positions": [], "suppliers": null, "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "created_at": "2026-02-02T09:29:06.535344+00:00", "product_id": null, "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-02", "peeling_date": "2026-02-02T00:00:00+00:00", "packaging_date": "2026-02-02", "warehouse_name": "CN Đắk Lắk"}', '{"code": "DL-LOT-020226-015", "notes": "", "qc_id": null, "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"edits": [{"id": "39f84b47-99c7-4b13-b384-e065a503450f", "date": "2026-02-02T09:29:47.480Z", "actor": "HTX Trái Cây ABC", "description": "Cập nhật thông tin lô hàng"}, {"id": "ddbfb04d-efbe-4466-8c23-180c3693c7f5", "date": "2026-02-02T09:31:37.024Z", "actor": "HTX Trái Cây ABC", "description": "Cập nhật thông tin lô hàng"}, {"id": "83917f35-f49d-4da6-8f29-b0f0aabc73d2", "date": "2026-02-02T09:34:38.881Z", "actor": "HTX Trái Cây ABC", "changes": ["Nhà cung cấp: N/A → N/A", "QC: N/A → N/A", "Batch NCC: N/A → N/A", "Tổng SL: 27 → 20"], "description": "Cập nhật thông tin lô hàng"}], "exports": [{"id": "ac41b07b-a0d2-435b-814c-c93aff24ad0c", "date": "2026-02-02T09:34:38.881Z", "draft": true, "items": {"0": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 7}}, "is_edit": true, "customer": "Hệ thống (Điều chỉnh)", "description": "Điều chỉnh số lượng LOT DL-LOT-020226-015", "is_adjustment": true, "location_code": "CN Đắk Lắk"}], "inbound": [{"id": "5f812dc0-5eac-4699-9259-0242b6ad2a7a", "date": "2026-02-02T09:29:06.424Z", "draft": false, "items": {"0": {"unit": "Thùng", "price": 0, "quantity": 25, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A"}}, "is_edit": true, "order_id": "bb4574c6-a34d-4432-b732-fd624e2b756e", "order_code": "DL-PNK-020226-001", "updated_at": "2026-02-02T09:29:47.480Z", "supplier_id": null, "supplier_name": "N/A"}, {"id": "49f14903-2233-4f21-bd50-2169113c948a", "date": "2026-02-02T09:31:37.024Z", "draft": false, "items": {"0": {"unit": "Thùng", "price": 0, "quantity": 2, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A"}}, "is_edit": true, "order_id": "f763cece-0417-4cd7-9eb8-0bfe9ed5e13b", "order_code": "DL-PNK-020226-002", "description": "Điều chỉnh số lượng LOT DL-LOT-020226-015", "supplier_id": null, "is_adjustment": true, "supplier_name": "N/A"}]}}, "quantity": 20, "lot_items": [{"unit": "Thùng", "quantity": 20, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-02", "peeling_date": "2026-02-02", "packaging_date": "2026-02-02", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-02 09:34:39.749641+00', 'KHO_DONG_LANH'),
	('4e168116-7244-46e1-ae45-ed66925bd357', 'lots', 'cae69942-40d6-4118-95d2-a49e206c1068', 'CREATE', NULL, '{"code": "DL-LOT-010226-004", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 26, "lot_items": [{"unit": "Thùng", "quantity": 26, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-01-31", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 08:01:05.394636+00', 'KHO_DONG_LANH'),
	('3ea87a17-dccd-44b4-8817-dff3fb2677fb', 'lots', 'ae2d50e4-e119-497f-a751-db217d64f564', 'CREATE', NULL, '{"code": "DL-LOT-010226-007", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-01-31", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 14:14:47.696413+00', 'KHO_DONG_LANH'),
	('a5021264-ddd1-4b8f-a78c-ccc1ca76671b', 'lots', '1b12c522-f648-4152-83f4-663ea73e2189', 'CREATE', NULL, '{"code": "DL-LOT-010226-017", "notes": "", "qc_id": "b7ad77b9-4ab8-420a-8fe5-80d390d6f172", "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-01-31", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 14:55:30.10594+00', 'KHO_DONG_LANH'),
	('5b1aa21c-77b2-4d62-b96d-8f0a6329855a', 'lots', 'fc961d83-5f7c-4dc6-96bd-c42318c9c4f9', 'CREATE', NULL, '{"code": "DL-LOT-020226-004", "notes": "", "qc_id": null, "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 25, "lot_items": [{"unit": "Thùng", "quantity": 25, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-01", "peeling_date": "2026-02-01", "packaging_date": "2026-02-01", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-01 17:29:00.35824+00', 'KHO_DONG_LANH'),
	('841858f8-2bb9-41ec-a75f-c976298c34dc', 'lots', 'aba93acc-73be-47e1-b0d0-6a2babb4d0bb', 'CREATE', NULL, '{"code": "DL-LOT-020226-013", "notes": "", "qc_id": null, "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"exports": [], "inbound": []}}, "quantity": 0, "lot_items": [], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-02", "peeling_date": "2026-02-02", "packaging_date": "2026-02-02", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-02 09:17:07.44998+00', 'KHO_DONG_LANH'),
	('9edb60b3-34f5-4a3d-a7e1-a286678f1ed0', 'lots', 'dbc042e3-c68a-40cb-93d5-87e4389598d0', 'UPDATE', '{"id": "dbc042e3-c68a-40cb-93d5-87e4389598d0", "code": "DL-LOT-020226-014", "notes": "", "qc_id": null, "images": [], "status": "active", "qc_info": null, "lot_tags": [], "metadata": {"extra_info": "", "system_history": {"edits": [{"id": "c07f478d-a83f-41f8-8c6a-ca413950dff1", "date": "2026-02-02T09:24:20.664Z", "actor": "HTX Trái Cây ABC", "description": "Cập nhật thông tin lô hàng"}, {"id": "486e8198-7d1d-4619-a018-0708ecf93da4", "date": "2026-02-02T09:35:36.296Z", "actor": "HTX Trái Cây ABC", "changes": ["Nhà cung cấp: N/A → N/A", "QC: N/A → N/A", "Batch NCC: N/A → N/A", "Tổng SL: 25 → 30"], "description": "Cập nhật thông tin lô hàng"}], "exports": [], "inbound": [{"id": "575c9afd-acf7-4bfd-9d53-47a0d1975e5c", "date": "2026-02-02T09:35:36.297Z", "draft": true, "items": {"0": {"unit": "Thùng", "price": 0, "quantity": 5, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A"}}, "is_edit": true, "description": "Điều chỉnh số lượng LOT DL-LOT-020226-014", "supplier_id": null, "is_adjustment": true, "supplier_name": "N/A"}]}}, "products": null, "quantity": 25, "lot_items": [{"id": "872ce22d-b799-42f6-80e6-7cec951d91d0", "unit": "Thùng", "products": {"sku": "TA", "name": "Sầu Riêng A", "unit": "Kg", "cost_price": 0, "product_code": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}, "quantity": 25, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "positions": [], "suppliers": null, "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "created_at": "2026-02-02T09:24:03.883823+00:00", "product_id": null, "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-02", "peeling_date": "2026-02-02T00:00:00+00:00", "packaging_date": "2026-02-02", "warehouse_name": "CN Đắk Lắk"}', '{"code": "DL-LOT-020226-014", "notes": "", "qc_id": null, "images": [], "status": "active", "metadata": {"extra_info": "", "system_history": {"edits": [{"id": "c07f478d-a83f-41f8-8c6a-ca413950dff1", "date": "2026-02-02T09:24:20.664Z", "actor": "HTX Trái Cây ABC", "description": "Cập nhật thông tin lô hàng"}, {"id": "486e8198-7d1d-4619-a018-0708ecf93da4", "date": "2026-02-02T09:35:36.296Z", "actor": "HTX Trái Cây ABC", "changes": ["Nhà cung cấp: N/A → N/A", "QC: N/A → N/A", "Batch NCC: N/A → N/A", "Tổng SL: 25 → 30"], "description": "Cập nhật thông tin lô hàng"}], "exports": [], "inbound": [{"id": "575c9afd-acf7-4bfd-9d53-47a0d1975e5c", "date": "2026-02-02T09:35:36.297Z", "draft": true, "items": {"0": {"unit": "Thùng", "price": 0, "quantity": 5, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A"}}, "is_edit": true, "description": "Điều chỉnh số lượng LOT DL-LOT-020226-014", "supplier_id": null, "is_adjustment": true, "supplier_name": "N/A"}]}}, "quantity": 30, "lot_items": [{"unit": "Thùng", "quantity": 30, "productId": "269c147e-5470-49bc-b9e7-17d6bcc87ccd"}], "batch_code": null, "company_id": "fafad42a-6e4c-43a4-acc1-39b614ab9cd0", "supplier_id": null, "system_code": "KHO_DONG_LANH", "inbound_date": "2026-02-02", "peeling_date": "2026-02-02", "packaging_date": "2026-02-02", "warehouse_name": "CN Đắk Lắk"}', '9bbeaa84-90d9-4064-a692-c58724a6228b', '2026-02-02 09:35:37.154166+00', 'KHO_DONG_LANH');


--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."companies" ("id", "name", "code", "tax_code", "address", "phone", "email", "is_active", "created_at", "updated_at", "username_prefix", "is_system", "unlocked_modules") VALUES
	('a0000000-0000-0000-0000-000000000001', 'AnyWarehouse (Hệ thống)', 'anywarehouse', NULL, NULL, NULL, NULL, true, '2026-01-29 07:53:32.605686+00', '2026-01-29 07:53:32.605686+00', NULL, true, '{images,inbound_basic,inbound_date,lot_accounting_sync,outbound_basic,packaging,stats_overview,warehouse_name}'),
	('fafad42a-6e4c-43a4-acc1-39b614ab9cd0', 'Hợp Tác Xã Trái Cây ABC', 'hop-tac-xa-trai-cay-abc', '', '35/3 Nguyễn Văn Linh', '0374944792', '', true, '2026-01-30 07:47:17.170151+00', '2026-01-30 07:47:17.170151+00', NULL, false, '{inbound_basic,outbound_basic,stats_overview,warehouse_name,inbound_date,packaging,inbound_supplier,categories_summary,recent_products,packaging_date,peeling_date,qc_info,extra_info,utility_qr_assign,auto_unbundle_lot,lot_accounting_sync}');


--
-- Data for Name: branches; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."branches" ("id", "code", "name", "address", "phone", "is_active", "created_at", "is_default", "system_type", "company_id") VALUES
	('aa1e068e-7383-4196-b412-925f10748fda', 'DEFAULT', 'Kho Mặc Định', '35/3 Nguyễn Văn Linh', '0374944792', true, '2026-01-30 07:47:18.138721+00', false, NULL, NULL),
	('5c1b2da2-9b1a-4d1d-9450-e16bdfa38b41', 'CN001', 'CN Đắk Lắk', '', '', true, '2026-02-01 06:45:33.899801+00', true, 'FROZEN', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0');


--
-- Data for Name: company_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."company_settings" ("id", "name", "tax_code", "address", "phone", "email", "website", "logo_url", "updated_at", "short_name", "code") VALUES
	('a0000000-0000-0000-0000-000000000001', 'AnyWarehouse (Hệ thống)', NULL, NULL, NULL, NULL, NULL, NULL, '2026-01-29 07:53:32.605686+00', 'AnyWH', NULL),
	('fafad42a-6e4c-43a4-acc1-39b614ab9cd0', 'Hợp Tác Xã Trái Cây ABC', '', '35/3 Nguyễn Văn Linh', '0374944792', '', '', NULL, '2026-02-01 05:41:24.149+00', 'HTX ABC', 'tabc');


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."categories" ("id", "name", "description", "created_at", "system_type", "company_id") VALUES
	('4f5c755e-dee7-442e-ba79-e241442f158a', 'Sầu Riêng', NULL, '2026-01-31 09:24:53.481774+00', 'KHO_DONG_LANH', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0');


--
-- Data for Name: platform_modules; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."platform_modules" ("code", "name", "description", "category", "price_monthly", "is_public", "status", "created_at", "updated_at") VALUES
	('CONSTRUCTION', 'Quản lý Công trình', 'Theo dõi dự án, tiến độ, và nhân sự thi công.', 'ADDON', 0, true, 'active', '2026-01-30 07:13:29.67567+00', '2026-01-30 07:13:29.67567+00'),
	('MANUFACTURING', 'Quản lý Sản xuất', 'Quy trình sản xuất, định mức vật tư, lệnh sản xuất.', 'ADDON', 0, true, 'active', '2026-01-30 07:13:29.67567+00', '2026-01-30 07:13:29.67567+00'),
	('ADVANCED_LOT', 'Quản lý Lô nâng cao', 'Tách/gộp lô, truy xuất nguồn gốc chi tiết.', 'UTILITY', 0, true, 'active', '2026-01-30 07:13:29.67567+00', '2026-01-30 07:13:29.67567+00'),
	('ECOMMERCE', 'Thương mại điện tử', 'Kết nối sàn TMĐT và quản lý đơn hàng online.', 'ADDON', 0, false, 'active', '2026-01-30 07:13:29.67567+00', '2026-01-30 07:13:29.67567+00');


--
-- Data for Name: company_subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."company_subscriptions" ("id", "company_id", "module_code", "status", "start_date", "end_date", "config", "created_at", "updated_at") VALUES
	('8db522c4-5452-4da8-bad4-6586eeacc904', 'a0000000-0000-0000-0000-000000000001', 'CONSTRUCTION', 'active', '2026-01-30 07:17:24.53637+00', NULL, '{}', '2026-01-30 07:17:24.53637+00', '2026-01-30 07:17:24.53637+00');


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."roles" ("id", "code", "name", "description", "permissions", "is_system", "created_at", "company_id") VALUES
	('4e8eeea7-07f6-4f01-bdc4-b7516bf35adb', 'MANAGER', 'Quản lý', 'Quản lý chung, có quyền cao nhất sau Admin', '["warehouse.view", "warehouse.manage", "inventory.view", "inventory.manage", "report.view"]', false, '2026-01-30 07:47:17.170151+00', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('067e2bbb-9ca6-49e2-8b80-de87e9bbad30', 'STAFF', 'Nhân viên Kho', 'Thực hiện nhập xuất và kiểm kê kho', '["warehouse.view", "inventory.view", "inventory.manage"]', false, '2026-01-30 07:47:17.170151+00', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('79116f5c-5bea-4afa-bb65-84cf13b3daec', 'ACCOUNTANT', 'Kế toán', 'Xem báo cáo và quản lý chứng từ', '["warehouse.view", "report.view", "inventory.view"]', false, '2026-01-30 07:47:17.170151+00', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('11961a66-ae12-42a0-8ea2-261b9d734fcc', 'SALES', 'Kinh doanh', 'Xem tồn kho và tạo đơn hàng', '["warehouse.view", "inventory.view"]', false, '2026-01-30 07:47:17.170151+00', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('d1eda974-9d42-4038-99c8-19b06a0b1738', 'STOREKEEPER', 'Thủ kho', 'Chịu trách nhiệm quản lý kho và hàng hóa', '["warehouse.view", "warehouse.manage", "inventory.view", "inventory.manage"]', false, '2026-01-30 07:47:17.170151+00', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('5b9c8fdb-7b52-404a-8275-66ee1bce1342', 'MANAGER', 'Quản lý', 'Quản lý chung, có quyền cao nhất sau Admin', '["warehouse.view", "warehouse.manage", "inventory.view", "inventory.manage", "report.view"]', false, '2026-01-29 09:49:14.148387+00', 'a0000000-0000-0000-0000-000000000001'),
	('3211da00-8736-4f4e-a0da-34384bb4c257', 'STAFF', 'Nhân viên Kho', 'Thực hiện nhập xuất và kiểm kê kho', '["warehouse.view", "inventory.view", "inventory.manage"]', false, '2026-01-29 09:49:14.148387+00', 'a0000000-0000-0000-0000-000000000001'),
	('99e6fa1b-759f-4978-939f-0d367339165c', 'ACCOUNTANT', 'Kế toán', 'Xem báo cáo và quản lý chứng từ', '["warehouse.view", "report.view", "inventory.view"]', false, '2026-01-29 09:49:14.148387+00', 'a0000000-0000-0000-0000-000000000001'),
	('c6eb6a38-b55c-4d1d-8a1a-d42ed5188a77', 'SALES', 'Kinh doanh', 'Xem tồn kho và tạo đơn hàng', '["warehouse.view", "inventory.view"]', false, '2026-01-29 09:49:14.148387+00', 'a0000000-0000-0000-0000-000000000001'),
	('8e8463a8-559f-4948-ba38-3408a350862c', 'STOREKEEPER', 'Thủ kho', 'Chịu trách nhiệm quản lý kho và hàng hóa', '["warehouse.view", "warehouse.manage", "inventory.view", "inventory.manage"]', false, '2026-01-29 09:51:04.719031+00', 'a0000000-0000-0000-0000-000000000001');


--
-- Data for Name: user_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."user_profiles" ("id", "employee_code", "full_name", "phone", "email", "avatar_url", "role_id", "department", "is_active", "last_login", "created_at", "updated_at", "username", "allowed_systems", "permissions", "blocked_routes", "hidden_menus", "favorite_menus", "company_id", "account_level") VALUES
	('a0ad4b7a-e0e5-42a0-bb06-4aa2b07c0018', 'TABC-NV002', 'dsasdasd', NULL, 'tabc.thukho2@system.local', NULL, '11961a66-ae12-42a0-8ea2-261b9d734fcc', 'ádasd', true, NULL, '2026-02-01 06:25:09.146322+00', '2026-02-01 06:25:09.146322+00', 'tabc.thukho2', '{FROZEN,KHO_DONG_LANH}', '{}', NULL, '{}', '[]', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0', 3),
	('1d502b01-df8b-4f27-9965-fa550a5b4096', NULL, 'Super Admin', NULL, 'tungdibui2609@gmail.com', 'https://res.cloudinary.com/diiyp32xv/image/upload/v1769758981/admin_avatars/admin_avatar_1d502b01-df8b-4f27-9965-fa550a5b4096.png', NULL, NULL, true, NULL, '2026-01-29 08:20:29.897603+00', '2026-01-30 07:43:03.95561+00', 'super_admin', '{ALL}', '{}', NULL, '{}', '[]', 'a0000000-0000-0000-0000-000000000001', 1),
	('9bbeaa84-90d9-4064-a692-c58724a6228b', NULL, 'HTX Trái Cây ABC', NULL, 'traicayabc@gmail.com', NULL, NULL, NULL, true, NULL, '2026-01-30 07:47:19.566989+00', '2026-01-30 07:47:19.566989+00', NULL, '{ALL}', '{system.full_access}', NULL, '{}', '[]', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0', 2),
	('8560fd3f-170f-4c54-bba8-86cf8ea09699', 'TABC-NV001', 'Thu Kho', NULL, 'tabc.thukho@system.local', NULL, 'd1eda974-9d42-4038-99c8-19b06a0b1738', NULL, true, NULL, '2026-02-01 05:42:01.712411+00', '2026-02-01 05:42:01.712411+00', 'tabc.thukho', '{FROZEN,KHO_DONG_LANH}', '{}', NULL, '{}', '[]', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0', 3);


--
-- Data for Name: construction_teams; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: construction_members; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: construction_projects; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: construction_phases; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: construction_tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: order_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."order_types" ("id", "name", "code", "scope", "description", "system_code", "is_active", "created_at", "updated_at", "company_id") VALUES
	('973fd0aa-024b-4442-9e64-d8aebd2574a0', 'Sản Xuất', 'ĐL-ML01', 'both', '', 'KHO_DONG_LANH', true, '2026-01-29 14:56:48.789247+00', '2026-01-29 14:56:48.789247+00', 'a0000000-0000-0000-0000-000000000001'),
	('92334ffe-709b-4c76-9dfd-abfc53b0ac37', 'Nhập Mới', 'ĐL-ML02', 'inbound', '', 'KHO_DONG_LANH', true, '2026-01-29 14:57:12.821855+00', '2026-01-29 14:57:12.821855+00', 'a0000000-0000-0000-0000-000000000001'),
	('c48225c7-4446-4c47-a86d-d6d05b6bb4c8', 'Bán', 'ĐL-ML03', 'outbound', '', 'KHO_DONG_LANH', true, '2026-01-29 14:57:21.547097+00', '2026-01-29 14:57:21.547097+00', 'a0000000-0000-0000-0000-000000000001');


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: inbound_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."inbound_orders" ("id", "code", "type", "status", "warehouse_name", "supplier_id", "created_by", "created_at", "updated_at", "description", "supplier_address", "supplier_phone", "image_url", "system_type", "system_code", "metadata", "order_type_id", "images", "company_id") VALUES
	('bb4574c6-a34d-4432-b732-fd624e2b756e', 'DL-PNK-020226-001', 'Import', 'Completed', 'CN Đắk Lắk', NULL, NULL, '2026-02-02 09:30:36.249218+00', '2026-02-02 09:30:36.249218+00', 'Phiếu nhập tổng cho 1 lô hàng.', NULL, NULL, NULL, 'KHO_DONG_LANH', 'KHO_DONG_LANH', '{"targetUnit": "Kg", "batch_inbound": true, "merged_inbounds": ["5f812dc0-5eac-4699-9259-0242b6ad2a7a"]}', NULL, '[]', NULL),
	('f763cece-0417-4cd7-9eb8-0bfe9ed5e13b', 'DL-PNK-020226-002', 'Import', 'Completed', 'CN Đắk Lắk', NULL, NULL, '2026-02-02 09:32:19.039038+00', '2026-02-02 09:32:19.039038+00', 'Phiếu nhập tổng cho 1 lô hàng.', NULL, NULL, NULL, 'KHO_DONG_LANH', 'KHO_DONG_LANH', '{"targetUnit": "Kg", "batch_inbound": true, "merged_inbounds": ["49f14903-2233-4f21-bd50-2169113c948a"]}', NULL, '[]', NULL);


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."products" ("id", "sku", "name", "category_id", "manufacturer", "part_number", "compatible_models", "unit", "min_stock_level", "image_url", "created_at", "updated_at", "description", "price", "oem_number", "origin_country", "quality_grade", "warranty_months", "weight_kg", "dimensions", "cost_price", "retail_price", "wholesale_price", "supplier_id", "lead_time_days", "is_active", "is_returnable", "cross_reference_numbers", "system_type", "specifications", "packaging_specification", "system_code", "company_id") VALUES
	('269c147e-5470-49bc-b9e7-17d6bcc87ccd', 'TA', 'Sầu Riêng A', '4f5c755e-dee7-442e-ba79-e241442f158a', NULL, NULL, NULL, 'Kg', 10, '', '2026-01-31 09:25:43.224065+00', '2026-01-31 09:25:43.224065+00', '', 0.00, NULL, NULL, NULL, 0, NULL, NULL, 0.00, 0.00, 0.00, NULL, 0, true, true, NULL, 'KHO_DONG_LANH', '{}', '', NULL, 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('124c83ea-9077-41e6-be89-d071bccebc02', 'tc', 'dsdsa', '4f5c755e-dee7-442e-ba79-e241442f158a', NULL, NULL, NULL, 'Kg', 10, '', '2026-02-01 17:43:10.460364+00', '2026-02-01 17:43:10.460364+00', '', 0.00, NULL, NULL, NULL, 0, NULL, NULL, 0.00, 0.00, 0.00, NULL, 0, true, true, NULL, 'KHO_DONG_LANH', '{}', '', NULL, 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('6cbf26a4-a91a-4bcc-b033-e3c46373df63', 'td', 'dsfsfsdfdsfggggggggggggggggggggg fdfd fdfdfd bbb', '4f5c755e-dee7-442e-ba79-e241442f158a', NULL, NULL, NULL, 'Kg', 10, '', '2026-02-01 17:43:38.156038+00', '2026-02-01 17:43:38.156038+00', '', 0.00, NULL, NULL, NULL, 0, NULL, NULL, 0.00, 0.00, 0.00, NULL, 0, true, true, NULL, 'KHO_DONG_LANH', '{}', '', NULL, 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0');


--
-- Data for Name: inbound_order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."inbound_order_items" ("id", "order_id", "product_id", "product_name", "unit", "quantity", "price", "note", "created_at", "document_quantity", "document_unit", "conversion_rate") VALUES
	('6b5845f1-9c16-4933-84ce-39284282b980', 'bb4574c6-a34d-4432-b732-fd624e2b756e', '269c147e-5470-49bc-b9e7-17d6bcc87ccd', 'Sầu Riêng A', 'Thùng', 25, 0.00, 'Nhập từ các LOT: DL-LOT-020226-015', '2026-02-02 09:30:36.71071+00', 25, NULL, 1),
	('edcaca88-2c25-4d80-8a92-f9b365f85713', 'f763cece-0417-4cd7-9eb8-0bfe9ed5e13b', '269c147e-5470-49bc-b9e7-17d6bcc87ccd', 'Sầu Riêng A', 'Thùng', 2, 0.00, 'Nhập từ các LOT: DL-LOT-020226-015', '2026-02-02 09:32:19.299781+00', 2, NULL, 1);


--
-- Data for Name: outbound_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."outbound_orders" ("id", "code", "type", "status", "warehouse_name", "customer_name", "created_by", "created_at", "updated_at", "description", "customer_address", "customer_phone", "image_url", "system_type", "system_code", "metadata", "order_type_id", "images", "company_id") VALUES
	('00f0503a-2d63-4f8e-a4a8-a6f98f1d6949', 'DL-PXK-020226-001', 'Export', 'Completed', 'CN Đắk Lắk', 'Hệ thống (Điều chỉnh)', NULL, '2026-02-02 09:50:48.433932+00', '2026-02-02 09:50:48.433932+00', 'Phiếu xuất tổng cho 1 lô hàng.', NULL, NULL, NULL, 'KHO_DONG_LANH', 'KHO_DONG_LANH', '{"targetUnit": "Kg", "batch_export": true, "merged_exports": ["ac41b07b-a0d2-435b-814c-c93aff24ad0c"]}', NULL, '[]', NULL);


--
-- Data for Name: inventory_checks; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: qc_info; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."qc_info" ("id", "name", "code", "description", "system_code", "is_active", "created_at", "updated_at", "company_id") VALUES
	('b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'Cúc', 'ĐL-QC01', '', 'KHO_DONG_LANH', true, '2026-02-01 06:45:01.440647+00', '2026-02-01 06:45:01.440647+00', NULL);


--
-- Data for Name: lots; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."lots" ("id", "code", "notes", "status", "product_id", "supplier_id", "inbound_date", "batch_code", "quantity", "created_at", "peeling_date", "qc_id", "system_code", "packaging_date", "warehouse_name", "images", "metadata", "company_id") VALUES
	('67bcf01d-9cbb-4a9b-aab1-54d5320eff4d', 'DL-LOT-010226-002', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 13:49:36.803393+00', '2026-01-31 00:00:00+00', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "4828bec6-cfec-4e56-a869-4590a00d3b14", "date": "2026-02-01T15:58:59.747Z", "draft": true, "items": {"bfc1db44-6eac-4a73-bfc1-e447ed38fdf4": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 23}}, "customer": "Khách lẻ", "order_id": null, "description": "", "location_code": "S.VT3"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('8f854631-1ebf-4719-993c-71f1824e0ff7', 'DL-LOT-010226-009', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 14:27:07.464084+00', '2026-01-31 00:00:00+00', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "b7cdb122-acb6-4b78-ba74-aaa78fa3d552", "date": "2026-02-01T17:11:36.852Z", "draft": true, "items": {"2b6330c3-eb81-4997-bed2-11ae806a056b": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 25}}, "customer": "Khách lẻ", "order_id": null, "description": "Bán hàng", "location_code": "S.VT9"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('64245054-e66a-4b06-a6d6-bd936ca5db0a', 'DL-LOT-010226-014', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 14:39:45.769081+00', '2026-01-31 00:00:00+00', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "baf2e106-e6ee-41aa-a79d-365d4be5b4b7", "date": "2026-02-01T15:56:22.324Z", "draft": true, "items": {"33bf83d7-d036-4539-8b97-52faaf3d0727": {"unit": "Kg", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 17.8}}, "customer": "Khách lẻ", "order_id": null, "description": "", "location_code": "S.VT15"}, {"id": "948431cd-ede5-4fe5-af0e-452ef03162d6", "date": "2026-02-01T17:21:38.087Z", "draft": true, "items": {"11d63b38-b493-4652-8cd8-d0e933877993": {"unit": "Kg", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 2.2}, "33bf83d7-d036-4539-8b97-52faaf3d0727": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 24}}, "customer": "Khách lẻ", "order_id": null, "description": "Xuất kho nhanh (Sơ đồ)", "location_code": "S.VT15"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('03da8a12-3ac9-497a-9cd8-e3a5b86605a6', 'DL-LOT-020226-007', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 17:44:18.508438+00', '2026-02-01 00:00:00+00', NULL, 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "6564c1ec-0c5f-4d97-b838-02afe3768a35", "date": "2026-02-01T17:55:52.769Z", "draft": true, "items": {"6462c98b-7c6f-4707-ab3b-5958ab3b2122": {"unit": "Kg", "cost_price": 0, "product_id": "124c83ea-9077-41e6-be89-d071bccebc02", "product_sku": "tc", "product_name": "dsdsa", "exported_quantity": 25}}, "customer": "Khách lẻ", "order_id": null, "description": "Xuất kho nhanh (Sơ đồ)", "location_code": "S.VT3"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('fc961d83-5f7c-4dc6-96bd-c42318c9c4f9', 'DL-LOT-020226-004', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 17:29:00.149357+00', '2026-02-01 00:00:00+00', NULL, 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "96b94347-ce65-4a90-89a9-e4f45200cbe9", "date": "2026-02-01T17:55:53.384Z", "draft": true, "items": {"1dd787f7-78a3-47e3-9701-a1f672a16e7e": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 25}}, "customer": "Khách lẻ", "order_id": null, "description": "Xuất kho nhanh (Sơ đồ)", "location_code": "S.VT4"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('374256f3-599e-45df-aaaf-d7e3ce01fdb7', 'DL-LOT-020226-012', '', 'active', NULL, NULL, '2026-01-27', NULL, 25, '2026-02-02 09:16:48.509248+00', '2026-01-25 00:00:00+00', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'KHO_DONG_LANH', '2026-01-27', 'CN Đắk Lắk', '[]', '{"extra_info": "KD/1/2", "system_history": {"exports": [], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('9bff788c-1a44-4111-916a-f0ee44c7c1bf', 'DL-LOT-010226-013', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 14:38:02.508978+00', '2026-01-31 00:00:00+00', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "1d00635d-877b-46b4-85e0-cc730836100e", "date": "2026-02-01T15:57:01.457Z", "draft": true, "items": {"19d79938-305b-4f0e-af1a-5f133e5af6ee": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 25}}, "customer": "Khách lẻ", "order_id": null, "description": "", "location_code": "S.VT14"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('6cb14875-edc2-487a-aa89-8e7775ccf85a', 'DL-LOT-010226-003', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 13:49:44.28129+00', '2026-01-31 00:00:00+00', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "ba414ff9-edc5-4752-955e-25c0e4be8b86", "date": "2026-02-01T17:15:55.995Z", "draft": true, "items": {"60cc6635-91d8-4351-9625-46b1601e864d": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 24}}, "customer": "Khách lẻ", "order_id": null, "description": "Xuất kho nhanh (Sơ đồ)", "location_code": "S.VT1"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('a1933cf4-ecdf-46b7-8fd2-0044e2ed97cc', 'DL-LOT-010226-011', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 14:28:57.960504+00', '2026-01-31 00:00:00+00', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "c109be9f-d455-4a53-abf2-74119a9921fa", "date": "2026-02-01T15:57:22.992Z", "draft": true, "items": {"eb5d62af-54d3-49ed-987c-b2e4ab0beaa2": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 25}}, "customer": "Khách lẻ", "order_id": null, "description": "", "location_code": "S.VT12"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('e6cd4f5f-6190-49fb-b33b-fa97ce87121d', 'DL-LOT-020226-010', '', 'exported', NULL, NULL, '2026-01-26', NULL, 0, '2026-02-02 05:26:41.285037+00', '2026-02-01 00:00:00+00', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'KHO_DONG_LANH', '2026-02-02', 'CN Đắk Lắk', '[]', '{"extra_info": "KD/BB2", "system_history": {"exports": [{"id": "9a91b469-893c-4e20-8f53-846e90bd56c0", "date": "2026-02-02T09:01:32.821Z", "draft": true, "items": {"2dacbd72-e6bf-49be-8d60-2b19d87cff5f": {"unit": "Thùng", "cost_price": 0, "product_id": "124c83ea-9077-41e6-be89-d071bccebc02", "product_sku": "tc", "product_name": "dsdsa", "exported_quantity": 25}, "5c44c16f-4618-40b5-81b9-1ff41e43afce": {"unit": "Kg", "cost_price": 0, "product_id": "124c83ea-9077-41e6-be89-d071bccebc02", "product_sku": "tc", "product_name": "dsdsa", "exported_quantity": 25}}, "customer": "Khách lẻ", "order_id": null, "description": "Xuất kho nhanh (Sơ đồ)", "location_code": "S.VT3"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('a441f57c-e092-4460-b9de-328ef58a9197', 'DL-LOT-020226-001', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 17:23:01.078479+00', '2026-02-01 00:00:00+00', NULL, 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "cffd5766-8a36-4d3d-8992-1bb99a1245cb", "date": "2026-02-01T17:26:35.395Z", "draft": true, "items": {"35f9166c-7782-4dea-b71a-35c68034d30c": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 25}, "4f1d7df2-506a-45f0-9be1-77ed73aceabe": {"unit": "Kg", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 10}}, "customer": "Khách lẻ", "order_id": null, "description": "Xuất kho nhanh (Sơ đồ)", "location_code": "S.VT1"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('843db159-185d-4d86-aa05-4efae82553a3', 'DL-LOT-020226-005', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 17:29:14.25508+00', '2026-02-01 00:00:00+00', NULL, 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "7ebe3279-9d53-43ee-ab51-a3eec73afe93", "date": "2026-02-01T17:55:51.444Z", "draft": true, "items": {"232a288e-198c-4a2b-834d-8c60c0d79adf": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 25}, "ff079edd-cef1-4d62-b641-be4cc80933c8": {"unit": "Kg", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 10}}, "customer": "Khách lẻ", "order_id": null, "description": "Xuất kho nhanh (Sơ đồ)", "location_code": "S.VT1"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('0ec26979-bd42-46da-9703-163d1202135b', 'DL-LOT-020226-008', '', 'exported', NULL, NULL, '2026-01-26', NULL, 0, '2026-02-02 05:25:58.058636+00', '2026-02-01 00:00:00+00', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'KHO_DONG_LANH', '2026-02-02', 'CN Đắk Lắk', '[]', '{"extra_info": "KD/BB2", "system_history": {"exports": [{"id": "a606e9a2-fd34-496b-b956-772e01894e8e", "date": "2026-02-02T09:01:29.132Z", "draft": true, "items": {"9c5745f6-7254-4337-97d8-a632025a6fc4": {"unit": "Kg", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 25}, "a10a23ef-3dc9-4e9b-bd1f-712217cb456b": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 25}}, "customer": "Khách lẻ", "order_id": null, "description": "Xuất kho nhanh (Sơ đồ)", "location_code": "S.VT1"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('2d88825d-b77c-4eb8-b07e-30caa181885c', 'DL-LOT-020226-009', '', 'exported', NULL, NULL, '2026-01-26', NULL, 0, '2026-02-02 05:26:15.029227+00', '2026-02-01 00:00:00+00', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'KHO_DONG_LANH', '2026-02-02', 'CN Đắk Lắk', '[]', '{"extra_info": "KD/BB2", "system_history": {"exports": [{"id": "3ebd6790-6422-452c-b999-9c47f6345351", "date": "2026-02-02T09:01:30.988Z", "draft": true, "items": {"1f052904-ad23-4093-8a2e-b6d11979af62": {"unit": "Thùng", "cost_price": 0, "product_id": "6cbf26a4-a91a-4bcc-b033-e3c46373df63", "product_sku": "td", "product_name": "dsfsfsdfdsfggggggggggggggggggggg fdfd fdfdfd bbb", "exported_quantity": 25}, "55e6bf83-edef-4972-869c-233c4af69cd6": {"unit": "Kg", "cost_price": 0, "product_id": "6cbf26a4-a91a-4bcc-b033-e3c46373df63", "product_sku": "td", "product_name": "dsfsfsdfdsfggggggggggggggggggggg fdfd fdfdfd bbb", "exported_quantity": 25}}, "customer": "Khách lẻ", "order_id": null, "description": "Xuất kho nhanh (Sơ đồ)", "location_code": "S.VT2"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('c47ff623-db9d-4470-9586-38b6913fb22b', 'DL-LOT-010226-020', '', 'active', NULL, NULL, '2026-02-01', NULL, 25, '2026-02-01 16:45:46.667284+00', '2026-02-01 00:00:00+00', NULL, 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('aba93acc-73be-47e1-b0d0-6a2babb4d0bb', 'DL-LOT-020226-013', '', 'active', NULL, NULL, '2026-02-02', NULL, 25, '2026-02-02 09:17:07.139075+00', '2026-02-02 00:00:00+00', NULL, 'KHO_DONG_LANH', '2026-02-02', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('16f1841b-839a-45a6-a5d2-d29ada0f837d', 'DL-LOT-010226-006', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 14:07:20.586867+00', '2026-01-31 00:00:00+00', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "9f7e79f2-a258-4fc7-ab5e-4bd1c0d4cdb0", "date": "2026-02-01T17:11:35.420Z", "draft": true, "items": {"2b234770-9264-44a4-bca6-57939cba9fe2": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 25}}, "customer": "Khách lẻ", "order_id": null, "description": "Bán hàng", "location_code": "S.VT7"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('d5a6b839-cc62-4e06-a45d-fb316eeb6230', 'DL-LOT-010226-001', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 13:49:28.003028+00', '2026-01-31 00:00:00+00', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "bbbba674-ca64-406c-9b69-3aace52d6743", "date": "2026-02-01T17:17:35.348Z", "draft": true, "items": {"2c26955e-0118-4f0b-956a-703474577a81": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 22}}, "customer": "Khách lẻ", "order_id": null, "description": "", "location_code": "S.VT21"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('178c8352-9fe5-48f9-8cd5-650d4ac43e24', 'DL-LOT-020226-002', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 17:23:12.985469+00', '2026-02-01 00:00:00+00', NULL, 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "aa5ce56c-021f-4a76-ad74-d54d7e0bd61a", "date": "2026-02-01T17:24:38.736Z", "draft": true, "items": {"f41ee3a8-8e55-4825-94f5-38f23e40f286": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 25}}, "customer": "Khách lẻ", "order_id": null, "description": "Xuất kho nhanh (Sơ đồ)", "location_code": "S.VT2"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('dcd78784-c6a5-44f6-a22f-abf4e1ae59ef', 'DL-LOT-020226-006', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 17:44:06.974175+00', '2026-02-01 00:00:00+00', NULL, 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "2528364c-3e08-4057-977a-4bb638eb7ddf", "date": "2026-02-01T17:55:52.134Z", "draft": true, "items": {"6b26dacb-01df-43fc-b245-4e67d640d172": {"unit": "Kg", "cost_price": 0, "product_id": "6cbf26a4-a91a-4bcc-b033-e3c46373df63", "product_sku": "td", "product_name": "dsfsfsdfdsfggggggggggggggggggggg fdfd fdfdfd bbb", "exported_quantity": 25}}, "customer": "Khách lẻ", "order_id": null, "description": "Xuất kho nhanh (Sơ đồ)", "location_code": "S.VT2"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('86b9d199-0547-4112-bb3c-b0f231f96664', 'DL-LOT-010226-015', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 14:49:09.269618+00', '2026-01-31 00:00:00+00', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "95d875dc-58cb-4830-930e-827211ad491c", "date": "2026-02-01T15:54:38.690Z", "draft": true, "items": {"653d4789-645f-4221-b5a7-724339b8da35": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 25}}, "customer": "Khách lẻ", "order_id": null, "description": "", "location_code": "S.VT16"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('2730183b-e4ca-4512-8d89-0e12468cfa96', 'DL-LOT-020226-011', '', 'exported', NULL, NULL, '2026-01-26', NULL, 0, '2026-02-02 07:09:21.258486+00', '2026-02-01 00:00:00+00', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'KHO_DONG_LANH', '2026-02-02', 'CN Đắk Lắk', '[]', '{"extra_info": "KD/BB3", "system_history": {"exports": [{"id": "d3f70ec5-1279-4b67-b2d4-6b0db0ba7e87", "date": "2026-02-02T09:01:34.649Z", "draft": true, "items": {"1b87d061-57d0-45b4-92aa-cb4b896e6748": {"unit": "Kg", "cost_price": 0, "product_id": "124c83ea-9077-41e6-be89-d071bccebc02", "product_sku": "tc", "product_name": "dsdsa", "exported_quantity": 25}, "3e9e64a3-1326-41eb-b940-8fdc5009a106": {"unit": "Thùng", "cost_price": 0, "product_id": "124c83ea-9077-41e6-be89-d071bccebc02", "product_sku": "tc", "product_name": "dsdsa", "exported_quantity": 25}}, "customer": "Khách lẻ", "order_id": null, "description": "Xuất kho nhanh (Sơ đồ)", "location_code": "S.VT9"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('6b1ecc63-2679-4f54-979b-b20fc128728e', 'DL-LOT-010226-010', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 14:28:52.195698+00', '2026-01-31 00:00:00+00', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "aeb0cf0c-51d5-4c98-adb5-53b970687976", "date": "2026-02-01T15:57:51.098Z", "draft": true, "items": {"105ce2da-2dd6-43f5-b823-c987d741e659": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 25}}, "customer": "Khách lẻ", "order_id": null, "description": "", "location_code": "S.VT11"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('b7c760a5-9720-46f9-bc55-955d5143e462', 'DL-LOT-010226-005', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 14:01:04.375991+00', '2026-01-31 00:00:00+00', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "cde22fad-d94e-45dc-acfd-a85fd4cb5d75", "date": "2026-02-01T15:58:30.608Z", "draft": true, "items": {"1c69be81-e312-47a3-bbce-6cc5ccefdb90": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 25}}, "customer": "Khách lẻ", "order_id": null, "description": "", "location_code": "S.VT6"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('e594de78-19fe-4397-b37f-180c39a7b10b', 'DL-LOT-010226-008', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 14:20:00.134534+00', '2026-01-31 00:00:00+00', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "d0fd1768-c3a8-47bc-917f-b6eeef868546", "date": "2026-02-01T17:11:36.139Z", "draft": true, "items": {"5bbd0124-5fb8-4c24-a56d-11f34540b982": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 25}}, "customer": "Khách lẻ", "order_id": null, "description": "Bán hàng", "location_code": "S.VT8"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('3e9ba386-e16e-447c-80d4-1c9af4db7c8b', 'DL-LOT-010226-004', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 13:59:55.834357+00', '2026-01-31 00:00:00+00', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "4aa34ce6-184f-43eb-8835-003db9566ce6", "date": "2026-02-01T17:13:39.907Z", "draft": true, "items": {"0fe47331-db92-4037-863f-9478b11e94ec": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 25}}, "customer": "Khách lẻ", "order_id": null, "description": "Xuất kho nhanh (Sơ đồ)", "location_code": "S.VT5"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('ae2d50e4-e119-497f-a751-db217d64f564', 'DL-LOT-010226-007', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 14:14:47.457554+00', '2026-01-31 00:00:00+00', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "918b4fd8-5a06-4832-a632-26123d68bbe4", "date": "2026-02-01T17:18:33.952Z", "draft": true, "items": {"6bbbb302-aab4-4241-9f77-e2cf0f1f9bab": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 25}}, "customer": "Khách lẻ", "order_id": null, "description": "", "location_code": "S.VT10"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('215c7ed9-7ac5-4262-86d6-ec8cd1f0ebc9', 'DL-LOT-020226-003', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 17:26:02.008535+00', '2026-02-01 00:00:00+00', NULL, 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "0c7770e5-bfc9-4147-897a-d16865c7ec8b", "date": "2026-02-01T17:26:35.965Z", "draft": true, "items": {"f5e67d73-1963-476d-b9f8-7d7fe5ffa799": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 25}}, "customer": "Khách lẻ", "order_id": null, "description": "Xuất kho nhanh (Sơ đồ)", "location_code": "S.VT2"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('1b03b413-1eeb-42f4-9499-68abbe8f6f92', 'DL-LOT-010226-019', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 15:01:05.744606+00', '2026-01-31 00:00:00+00', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "f8206cdb-db3c-4e56-b5e4-d696d371b8d5", "date": "2026-02-01T15:53:32.005Z", "draft": true, "items": {"ab629160-5052-4bf1-8a0e-f077a46be82d": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 25}}, "customer": "Khách lẻ", "order_id": null, "description": "Xuất sản xuất", "location_code": "S.VT2"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('f8a35aef-de0a-43fa-a461-29464d88007e', 'DL-LOT-010226-018', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 14:55:35.687552+00', '2026-01-31 00:00:00+00', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "e13b1b33-dbf4-4ae8-9969-aa9e3d3cbc08", "date": "2026-02-01T15:54:05.379Z", "draft": true, "items": {"a5fcb141-34a2-4332-ad88-b6efdd3a448d": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 25}}, "customer": "Khách lẻ", "order_id": null, "description": "Phân loại", "location_code": "S.VT18"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('1b12c522-f648-4152-83f4-663ea73e2189', 'DL-LOT-010226-017', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 14:55:29.865743+00', '2026-01-31 00:00:00+00', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "b37b8722-5734-4eea-b16b-c13fe0e0b741", "date": "2026-02-01T15:54:15.236Z", "draft": true, "items": {"5e00d9a4-d393-47b1-8fc7-8baf46925c95": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 25}}, "customer": "Khách lẻ", "order_id": null, "description": "", "location_code": "S.VT19"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('722f6ea2-8a25-4dfc-a4c4-0cce6f14749b', 'DL-LOT-010226-016', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 14:52:37.551696+00', '2026-01-31 00:00:00+00', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "ba8b55f3-a8ca-467f-b478-296ae562341e", "date": "2026-02-01T15:54:28.545Z", "draft": true, "items": {"840d4460-7668-4173-bd5f-facb0f9f6a04": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 25}}, "customer": "Khách lẻ", "order_id": null, "description": "", "location_code": "S.VT17"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('d760a75b-895e-4238-bc25-02e6d75b03fc', 'DL-LOT-010226-012', '', 'exported', NULL, NULL, '2026-02-01', NULL, 0, '2026-02-01 14:37:55.936579+00', '2026-01-31 00:00:00+00', 'b7ad77b9-4ab8-420a-8fe5-80d390d6f172', 'KHO_DONG_LANH', '2026-02-01', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"exports": [{"id": "cd1ba82f-4ad0-4c6e-9955-00cecbdce757", "date": "2026-02-01T15:57:13.439Z", "draft": true, "items": {"7684f92c-fa6e-4cee-b6e4-5e76ba333d32": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 25}}, "customer": "Khách lẻ", "order_id": null, "description": "", "location_code": "S.VT13"}], "inbound": []}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('dbc042e3-c68a-40cb-93d5-87e4389598d0', 'DL-LOT-020226-014', '', 'active', NULL, NULL, '2026-02-02', NULL, 30, '2026-02-02 09:24:03.883823+00', '2026-02-02 00:00:00+00', NULL, 'KHO_DONG_LANH', '2026-02-02', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"edits": [{"id": "c07f478d-a83f-41f8-8c6a-ca413950dff1", "date": "2026-02-02T09:24:20.664Z", "actor": "HTX Trái Cây ABC", "description": "Cập nhật thông tin lô hàng"}, {"id": "486e8198-7d1d-4619-a018-0708ecf93da4", "date": "2026-02-02T09:35:36.296Z", "actor": "HTX Trái Cây ABC", "changes": ["Nhà cung cấp: N/A → N/A", "QC: N/A → N/A", "Batch NCC: N/A → N/A", "Tổng SL: 25 → 30"], "description": "Cập nhật thông tin lô hàng"}], "exports": [], "inbound": [{"id": "575c9afd-acf7-4bfd-9d53-47a0d1975e5c", "date": "2026-02-02T09:35:36.297Z", "draft": true, "items": {"0": {"unit": "Thùng", "price": 0, "quantity": 5, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A"}}, "is_edit": true, "description": "Điều chỉnh số lượng LOT DL-LOT-020226-014", "supplier_id": null, "is_adjustment": true, "supplier_name": "N/A"}]}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('98044d5d-6207-4bef-b31f-7ea2ed989de7', 'DL-LOT-020226-015', '', 'active', NULL, NULL, '2026-02-02', NULL, 20, '2026-02-02 09:29:06.535344+00', '2026-02-02 00:00:00+00', NULL, 'KHO_DONG_LANH', '2026-02-02', 'CN Đắk Lắk', '[]', '{"extra_info": "", "system_history": {"edits": [{"id": "39f84b47-99c7-4b13-b384-e065a503450f", "date": "2026-02-02T09:29:47.480Z", "actor": "HTX Trái Cây ABC", "description": "Cập nhật thông tin lô hàng"}, {"id": "ddbfb04d-efbe-4466-8c23-180c3693c7f5", "date": "2026-02-02T09:31:37.024Z", "actor": "HTX Trái Cây ABC", "description": "Cập nhật thông tin lô hàng"}, {"id": "83917f35-f49d-4da6-8f29-b0f0aabc73d2", "date": "2026-02-02T09:34:38.881Z", "actor": "HTX Trái Cây ABC", "changes": ["Nhà cung cấp: N/A → N/A", "QC: N/A → N/A", "Batch NCC: N/A → N/A", "Tổng SL: 27 → 20"], "description": "Cập nhật thông tin lô hàng"}], "exports": [{"id": "ac41b07b-a0d2-435b-814c-c93aff24ad0c", "date": "2026-02-02T09:34:38.881Z", "draft": false, "items": {"0": {"unit": "Thùng", "cost_price": 0, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A", "exported_quantity": 7}}, "is_edit": true, "customer": "Hệ thống (Điều chỉnh)", "order_id": "00f0503a-2d63-4f8e-a4a8-a6f98f1d6949", "order_code": "DL-PXK-020226-001", "description": "Điều chỉnh số lượng LOT DL-LOT-020226-015", "is_adjustment": true, "location_code": "CN Đắk Lắk"}], "inbound": [{"id": "5f812dc0-5eac-4699-9259-0242b6ad2a7a", "date": "2026-02-02T09:29:06.424Z", "draft": false, "items": {"0": {"unit": "Thùng", "price": 0, "quantity": 25, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A"}}, "is_edit": true, "order_id": "bb4574c6-a34d-4432-b732-fd624e2b756e", "order_code": "DL-PNK-020226-001", "updated_at": "2026-02-02T09:29:47.480Z", "supplier_id": null, "supplier_name": "N/A"}, {"id": "49f14903-2233-4f21-bd50-2169113c948a", "date": "2026-02-02T09:31:37.024Z", "draft": false, "items": {"0": {"unit": "Thùng", "price": 0, "quantity": 2, "product_id": "269c147e-5470-49bc-b9e7-17d6bcc87ccd", "product_sku": "TA", "product_name": "Sầu Riêng A"}}, "is_edit": true, "order_id": "f763cece-0417-4cd7-9eb8-0bfe9ed5e13b", "order_code": "DL-PNK-020226-002", "description": "Điều chỉnh số lượng LOT DL-LOT-020226-015", "supplier_id": null, "is_adjustment": true, "supplier_name": "N/A"}]}}', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0');


--
-- Data for Name: lot_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."lot_items" ("id", "created_at", "lot_id", "product_id", "quantity", "unit") VALUES
	('e1ad7263-8200-4ef1-aa4a-60f666105380', '2026-02-02 09:35:36.906332+00', 'dbc042e3-c68a-40cb-93d5-87e4389598d0', '269c147e-5470-49bc-b9e7-17d6bcc87ccd', 30, 'Thùng'),
	('4a62446b-e78b-400c-95c4-1752583dd5e9', '2026-02-02 09:14:17.692601+00', 'c47ff623-db9d-4470-9586-38b6913fb22b', '269c147e-5470-49bc-b9e7-17d6bcc87ccd', 25, 'Thùng'),
	('06da26e8-c00c-4a08-b1b4-a73f081131ac', '2026-02-02 09:16:48.760032+00', '374256f3-599e-45df-aaaf-d7e3ce01fdb7', '124c83ea-9077-41e6-be89-d071bccebc02', 25, 'Thùng'),
	('6577bed7-ea96-4556-b15c-0081df4f8543', '2026-02-02 09:18:02.992487+00', 'aba93acc-73be-47e1-b0d0-6a2babb4d0bb', '269c147e-5470-49bc-b9e7-17d6bcc87ccd', 25, 'Thùng'),
	('a6ffc758-a276-42cd-8597-94ce42df43c3', '2026-02-02 09:34:39.490738+00', '98044d5d-6207-4bef-b31f-7ea2ed989de7', '269c147e-5470-49bc-b9e7-17d6bcc87ccd', 20, 'Thùng');


--
-- Data for Name: inventory_check_items; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: warehouses; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: locations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: lot_tags; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: master_tags; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."master_tags" ("name", "created_at", "created_by", "system_code", "company_id") VALUES
	('CONT1', '2026-02-02 05:32:19.683013+00', NULL, 'KHO_DONG_LANH', NULL),
	('TIỀN GIANG', '2026-02-02 05:32:20.329602+00', NULL, 'KHO_DONG_LANH', NULL),
	('HÀNG HƯ', '2026-02-02 05:44:22.489514+00', NULL, 'KHO_DONG_LANH', NULL),
	('HÀNG ĐẸP', '2026-02-02 05:48:23.427064+00', NULL, 'KHO_DONG_LANH', NULL);


--
-- Data for Name: operational_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: origins; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: outbound_order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."outbound_order_items" ("id", "order_id", "product_id", "product_name", "unit", "quantity", "price", "note", "created_at", "document_quantity", "document_unit", "conversion_rate") VALUES
	('fecc75a9-19d8-4750-ac61-7aff616ca6a1', '00f0503a-2d63-4f8e-a4a8-a6f98f1d6949', '269c147e-5470-49bc-b9e7-17d6bcc87ccd', 'Sầu Riêng A', 'Thùng', 7, 0.00, 'Xuất từ các LOT: DL-LOT-020226-015', '2026-02-02 09:50:48.902317+00', 7, NULL, 1);


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."permissions" ("id", "code", "name", "description", "module", "created_at", "company_id") VALUES
	('41d892a7-8b65-4fa6-b842-2bee540284ec', 'product.view', 'Xem Sản phẩm', 'Xem danh sách sản phẩm', 'Hàng hóa', '2026-01-20 07:35:40.631558+00', 'a0000000-0000-0000-0000-000000000001'),
	('32d3f7c4-ea31-4ec8-9b60-69cf27b70595', 'inventory.view', 'Xem Tồn kho', 'Xem báo cáo tồn kho', 'Hàng hóa', '2026-01-20 07:35:40.631558+00', 'a0000000-0000-0000-0000-000000000001'),
	('b046f344-9b65-4d93-ab0f-ac7f317aaa79', 'product.create', 'Thêm sản phẩm', 'Cho phép tạo mới sản phẩm', 'Sản phẩm', '2026-01-20 07:35:40.631558+00', 'a0000000-0000-0000-0000-000000000001'),
	('df7391bc-e121-43f3-b230-a9257f0563c2', 'product.edit', 'Sửa sản phẩm', 'Cho phép chỉnh sửa thông tin sản phẩm', 'Sản phẩm', '2026-01-20 07:35:40.631558+00', 'a0000000-0000-0000-0000-000000000001'),
	('d7bb968b-8c16-4777-9272-7484a9764c42', 'product.delete', 'Xóa sản phẩm', 'Cho phép xóa sản phẩm', 'Sản phẩm', '2026-01-20 07:35:40.631558+00', 'a0000000-0000-0000-0000-000000000001'),
	('12ddd8c9-fd14-420a-900c-2dae5b062c1d', 'inventory.adjust', 'Kiểm kê/Điều chỉnh', 'Cho phép điều chỉnh số lượng tồn kho', 'Kho', '2026-01-20 07:35:40.631558+00', 'a0000000-0000-0000-0000-000000000001'),
	('35a35dcd-2564-407b-af59-d49dc9b48eb8', 'inbound.view', 'Xem nhập kho', 'Cho phép xem lịch sử nhập kho', 'Nhập kho', '2026-01-20 07:35:40.631558+00', 'a0000000-0000-0000-0000-000000000001'),
	('05db0f47-6b1c-48fc-819d-51bba3547054', 'inbound.create', 'Tạo phiếu nhập', 'Cho phép tạo phiếu nhập kho mới', 'Nhập kho', '2026-01-20 07:35:40.631558+00', 'a0000000-0000-0000-0000-000000000001'),
	('2614ade5-d8c9-419d-92e4-624135768954', 'outbound.view', 'Xem xuất kho', 'Cho phép xem lịch sử xuất kho', 'Xuất kho', '2026-01-20 07:35:40.631558+00', 'a0000000-0000-0000-0000-000000000001'),
	('9cf4dbe7-caed-4179-876f-d995bdb0c90d', 'outbound.create', 'Tạo phiếu xuất', 'Cho phép tạo phiếu xuất kho mới', 'Xuất kho', '2026-01-20 07:35:40.631558+00', 'a0000000-0000-0000-0000-000000000001'),
	('7b5395e1-ba61-45e1-aab3-37389ec48a6a', 'partner.edit', 'Quản lý đối tác', 'Thêm/Sửa/Xóa khách hàng và nhà cung cấp', 'Đối tác', '2026-01-20 07:35:40.631558+00', 'a0000000-0000-0000-0000-000000000001'),
	('76504d53-5cc9-4c1d-ad24-ea19ca705a4e', 'user.view', 'Xem người dùng', 'Xem danh sách người dùng', 'Hệ thống', '2026-01-20 07:35:40.631558+00', 'a0000000-0000-0000-0000-000000000001'),
	('748f200e-af9c-460d-94e9-eedf67b548e8', 'user.manage', 'Quản lý người dùng', 'Tạo, sửa, phân quyền người dùng', 'Hệ thống', '2026-01-20 07:35:40.631558+00', 'a0000000-0000-0000-0000-000000000001'),
	('36afcc0b-f596-4375-86ef-f6213ce629f0', 'inbound.approve', 'Duyệt phiếu nhập', 'Cho phép xác nhận hoàn thành nhập kho', 'Nhập kho', '2026-01-20 09:25:35.709654+00', 'a0000000-0000-0000-0000-000000000001'),
	('8d620854-9a6e-4c8e-be37-389991cc1500', 'outbound.approve', 'Duyệt phiếu xuất', 'Cho phép xác nhận hoàn thành xuất kho', 'Xuất kho', '2026-01-20 09:25:35.709654+00', 'a0000000-0000-0000-0000-000000000001'),
	('e6d3b986-0b8e-428b-a2c0-72d39d1ef3fc', 'warehouse.map', 'Quản lý Sơ đồ kho', 'Xem và thiết kế sơ đồ vị trí kho', 'Kho vận', '2026-01-29 12:17:22.601274+00', 'a0000000-0000-0000-0000-000000000001'),
	('0d1fa210-4854-43e8-b1e8-c27bbef044a6', 'product.manage', 'Quản lý Sản phẩm', 'Thêm, sửa, xóa sản phẩm', 'Hàng hóa', '2026-01-29 12:17:22.601274+00', 'a0000000-0000-0000-0000-000000000001'),
	('9a70252e-ffcd-4843-b965-c685378048e4', 'category.view', 'Xem Danh mục', 'Xem danh mục sản phẩm', 'Hàng hóa', '2026-01-29 14:04:56.665934+00', 'a0000000-0000-0000-0000-000000000001'),
	('dd2a238e-1aa0-4e15-ba85-d242545326ff', 'category.manage', 'Quản lý Danh mục', 'Thêm, sửa, xóa danh mục', 'Hàng hóa', '2026-01-29 14:04:56.665934+00', 'a0000000-0000-0000-0000-000000000001'),
	('ff8619c9-d20b-45bc-9e56-570b61017fbf', 'unit.view', 'Xem Đơn vị', 'Xem danh sách đơn vị tính', 'Hàng hóa', '2026-01-29 14:04:56.665934+00', 'a0000000-0000-0000-0000-000000000001'),
	('a06d22f6-52c1-4fff-a6f2-b995aadcad34', 'unit.manage', 'Quản lý Đơn vị', 'Thêm, sửa, xóa đơn vị tính', 'Hàng hóa', '2026-01-29 14:04:56.665934+00', 'a0000000-0000-0000-0000-000000000001'),
	('4ec247ed-e7f0-4ebd-b5c5-d259a2bea6bf', 'origin.view', 'Xem Xuất xứ', 'Xem danh sách xuất xứ', 'Hàng hóa', '2026-01-29 14:04:56.665934+00', 'a0000000-0000-0000-0000-000000000001'),
	('8adf4ad5-8e45-45a6-829d-e88457a29dfb', 'origin.manage', 'Quản lý Xuất xứ', 'Thêm, sửa, xóa xuất xứ', 'Hàng hóa', '2026-01-29 14:04:56.665934+00', 'a0000000-0000-0000-0000-000000000001'),
	('32225873-4e34-4638-a302-32e0ceb5d7c0', 'vehicle.view', 'Xem Dòng xe', 'Xem danh sách dòng xe', 'Hàng hóa', '2026-01-29 12:17:22.601274+00', 'a0000000-0000-0000-0000-000000000001'),
	('c9db7833-84b6-4131-bee7-16f23b411454', 'vehicle.manage', 'Quản lý Dòng xe', 'Thêm, sửa, xóa dòng xe', 'Hàng hóa', '2026-01-29 12:17:22.601274+00', 'a0000000-0000-0000-0000-000000000001'),
	('5bb506b9-a7c5-4ea4-aee7-63e28305e862', 'partner.view', 'Xem Đối tác', 'Xem khách hàng và nhà cung cấp', 'Đối tác', '2026-01-20 07:35:40.631558+00', 'a0000000-0000-0000-0000-000000000001'),
	('a203dc76-365d-4f7e-b895-306a6c2ef6a6', 'partner.manage', 'Quản lý Đối tác', 'Thêm, sửa, xóa NCC và khách hàng', 'Đối tác', '2026-01-29 12:17:22.601274+00', 'a0000000-0000-0000-0000-000000000001'),
	('ca6e3f65-fe5b-40f2-8e50-14f72871080d', 'warehouse.view', 'Xem Kho hàng', 'Xem danh sách kho và vị trí', 'Kho vận', '2026-01-29 09:49:14.148387+00', 'a0000000-0000-0000-0000-000000000001'),
	('4d2ed952-0633-4174-9684-87da846f87d8', 'warehouse.manage', 'Quản lý Kho hàng', 'Thêm, sửa, xóa kho và vị trí', 'Kho vận', '2026-01-29 09:49:14.148387+00', 'a0000000-0000-0000-0000-000000000001'),
	('ed15c737-5aec-412b-8ea8-dd4ba8b73288', 'warehousemap.manage', 'Thiết kế sơ đồ', 'Thiết kế layout sơ đồ vị trí kho', 'Kho vận', '2026-01-29 14:39:15.404373+00', 'a0000000-0000-0000-0000-000000000001'),
	('b3df0553-bdd1-4223-add9-481761171d8f', 'inventory.manage', 'Quản lý Tồn kho', 'Điều chỉnh tồn kho', 'Hàng hóa', '2026-01-29 09:49:14.148387+00', 'a0000000-0000-0000-0000-000000000001'),
	('8764ec27-0195-419e-9378-73432f74c355', 'lotcode.view', 'Xem Mã lô', 'Xem danh sách mã lô', 'Kho vận', '2026-01-29 14:43:16.675854+00', 'a0000000-0000-0000-0000-000000000001'),
	('7df5ebd5-7651-4897-bc01-fb3935821f1c', 'lotcode.manage', 'Quản lý Mã lô', 'Thêm, xóa mã lô', 'Kho vận', '2026-01-29 14:43:16.675854+00', 'a0000000-0000-0000-0000-000000000001'),
	('e4c8cbdc-8316-4ce3-a9b2-c2d8f64ec94f', 'lot.view', 'Xem LOT', 'Xem danh sách lô hàng', 'Kho vận', '2026-01-29 13:41:13.515994+00', 'a0000000-0000-0000-0000-000000000001'),
	('2cb55775-fdd5-419f-9f80-77a9feab9bed', 'lot.manage', 'Quản lý LOT', 'Tạo, sửa, xóa, tách, gộp, xuất lô', 'Kho vận', '2026-01-29 13:41:13.515994+00', 'a0000000-0000-0000-0000-000000000001'),
	('33150a1e-2237-44eb-875a-248041fd9f89', 'order.view', 'Xem Phiếu nhập/xuất', 'Xem danh sách phiếu', 'Đơn hàng', '2026-01-29 13:41:13.515994+00', 'a0000000-0000-0000-0000-000000000001'),
	('5312f88b-11d4-4777-9f37-396436da8783', 'order.manage', 'Quản lý Phiếu nhập/xuất', 'Tạo, sửa, xóa phiếu', 'Đơn hàng', '2026-01-29 13:41:13.515994+00', 'a0000000-0000-0000-0000-000000000001'),
	('a285cb38-b274-40f0-96cb-912f4f03fe0a', 'qc.view', 'Xem QC', 'Xem danh sách kiểm hàng', 'Kho vận', '2026-01-29 12:17:22.601274+00', 'a0000000-0000-0000-0000-000000000001'),
	('ef1bb575-10ae-42c7-bda2-d0ef64d1ecc4', 'qc.manage', 'Quản lý QC', 'Tạo và cập nhật phiếu QC', 'Kho vận', '2026-01-29 12:17:22.601274+00', 'a0000000-0000-0000-0000-000000000001'),
	('7ec2d226-8145-4328-853e-5b0df9f798ea', 'site_inventory.view', 'Xem Kho công trình', 'Xem tồn kho tại công trình', 'Kho vận', '2026-01-29 12:17:22.601274+00', 'a0000000-0000-0000-0000-000000000001'),
	('cf3025fa-e6c8-4abf-a793-b542c27e20b0', 'site_inventory.manage', 'Quản lý Kho công trình', 'Xuất nhập kho công trình', 'Kho vận', '2026-01-29 12:17:22.601274+00', 'a0000000-0000-0000-0000-000000000001'),
	('5529a715-c00d-4a99-8ea3-0e1b383bf06c', 'report.view', 'Xem Báo cáo', 'Xem các báo cáo hệ thống', 'Báo cáo', '2026-01-20 07:35:40.631558+00', 'a0000000-0000-0000-0000-000000000001'),
	('4cf087e3-12d7-4ef5-81e0-e24377197921', 'system.full_access', 'Quản trị hệ thống', 'Quyên cao nhất, quản lý toàn bộ hệ thống', 'Hệ thống', '2026-01-29 09:49:14.148387+00', 'a0000000-0000-0000-0000-000000000001');


--
-- Data for Name: positions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."positions" ("id", "code", "display_order", "created_at", "batch_name", "lot_id", "system_type", "company_id") VALUES
	('46ada4a1-6c1d-4281-8fdf-cd3eaef34bf7', 'S.VT4', 4, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('3bce6107-1467-4f49-9850-628902014a6a', 'S.VT1', 1, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('0ee76653-6a35-4470-b479-0b8934e818ee', 'S.VT2', 2, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('60afbc3a-c3bc-4a1e-a60e-524f01ecbc50', 'S.VT3', 3, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('09383cff-c508-4a25-8ff0-01db493237e9', 'S.VT9', 9, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('38cf3803-b4e3-4f42-be0f-f265c1b53fdc', 'TANG.VT1', 1, '2026-02-02 09:13:26.31561+00', 'Batch 16:13:22 - Tầng', NULL, 'KHO_DONG_LANH', NULL),
	('2ce40db1-68ce-4b91-8c78-c267866f4f89', 'TANG.VT2', 2, '2026-02-02 09:13:26.31561+00', 'Batch 16:13:22 - Tầng', NULL, 'KHO_DONG_LANH', NULL),
	('500088eb-5028-4780-83f7-270ccb6015a9', 'TANG.VT3', 3, '2026-02-02 09:13:26.31561+00', 'Batch 16:13:22 - Tầng', NULL, 'KHO_DONG_LANH', NULL),
	('b46104d3-4ca5-47da-891e-c1d47196aa27', 'TANG.VT4', 4, '2026-02-02 09:13:26.31561+00', 'Batch 16:13:22 - Tầng', NULL, 'KHO_DONG_LANH', NULL),
	('b5ad6e49-519a-46ef-8b66-df8babacf3f5', 'TANG.VT5', 5, '2026-02-02 09:13:26.31561+00', 'Batch 16:13:22 - Tầng', NULL, 'KHO_DONG_LANH', NULL),
	('425760b5-cfd9-4b05-9cf2-780de881c405', 'TANG.VT6', 6, '2026-02-02 09:13:26.31561+00', 'Batch 16:13:22 - Tầng', NULL, 'KHO_DONG_LANH', NULL),
	('d742cd37-0728-4d98-81fd-eb03c373d8b8', 'TANG.VT7', 7, '2026-02-02 09:13:26.31561+00', 'Batch 16:13:22 - Tầng', NULL, 'KHO_DONG_LANH', NULL),
	('0c754686-0dda-4049-9d71-f8ad14f45db8', 'TANG.VT8', 8, '2026-02-02 09:13:26.31561+00', 'Batch 16:13:22 - Tầng', NULL, 'KHO_DONG_LANH', NULL),
	('391717a6-4b6b-47fe-9f0e-77edcff11874', 'TANG.VT9', 9, '2026-02-02 09:13:26.31561+00', 'Batch 16:13:22 - Tầng', NULL, 'KHO_DONG_LANH', NULL),
	('c2e2a57a-c1a1-46e6-b4f5-a6efdb3a7ca2', 'TANG.VT10', 10, '2026-02-02 09:13:26.31561+00', 'Batch 16:13:22 - Tầng', NULL, 'KHO_DONG_LANH', NULL),
	('0d9f0fb6-e665-45cc-aac0-c164e23efb4a', 'TANG.VT11', 11, '2026-02-02 09:13:26.31561+00', 'Batch 16:13:22 - Tầng', NULL, 'KHO_DONG_LANH', NULL),
	('eee867e2-9cdd-4830-bb95-6ae32ee8f4fe', 'TANG.VT12', 12, '2026-02-02 09:13:26.31561+00', 'Batch 16:13:22 - Tầng', NULL, 'KHO_DONG_LANH', NULL),
	('2d1f5350-0756-4f36-af0e-65c9d2f9f16e', 'TANG.VT13', 13, '2026-02-02 09:13:26.31561+00', 'Batch 16:13:22 - Tầng', NULL, 'KHO_DONG_LANH', NULL),
	('f4d765c4-f170-4f78-b54b-34a07bf5c81d', 'TANG.VT14', 14, '2026-02-02 09:13:26.31561+00', 'Batch 16:13:22 - Tầng', NULL, 'KHO_DONG_LANH', NULL),
	('908e5631-899d-4331-8170-77372483a1a0', 'TANG.VT15', 15, '2026-02-02 09:13:26.31561+00', 'Batch 16:13:22 - Tầng', NULL, 'KHO_DONG_LANH', NULL),
	('395e69e1-b080-4ab9-9a1c-3999ed70fd54', 'S.VT8', 8, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('910fb45c-dd30-4492-852d-bcfefa26afb7', 'S.VT5', 5, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('8afb6661-c6b3-4232-bf92-958948ceb1d3', 'TANG.VT16', 16, '2026-02-02 09:13:26.31561+00', 'Batch 16:13:22 - Tầng', NULL, 'KHO_DONG_LANH', NULL),
	('092da9c4-c62c-4562-a2a9-6a1a4ab60464', 'S.VT21', 21, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('872ba1d1-11d6-44ad-b5d1-dbcd8dd7a95f', 'S.VT10', 10, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('bc4d2df7-b0a3-4396-a6f8-e919e6e619a4', 'S.VT15', 15, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('958f49a1-7db3-471a-934c-23369c694252', 'TANG.VT17', 17, '2026-02-02 09:13:26.31561+00', 'Batch 16:13:22 - Tầng', NULL, 'KHO_DONG_LANH', NULL),
	('f281997d-0eb9-4925-a6b2-9c9dc2fa16f4', 'TANG.VT18', 18, '2026-02-02 09:13:26.31561+00', 'Batch 16:13:22 - Tầng', NULL, 'KHO_DONG_LANH', NULL),
	('50626555-956e-41a3-8524-f1f37af379fc', 'TANG.VT19', 19, '2026-02-02 09:13:26.31561+00', 'Batch 16:13:22 - Tầng', NULL, 'KHO_DONG_LANH', NULL),
	('d34dbe4a-62c2-46dd-9fd6-9261449c4a78', 'TANG.VT20', 20, '2026-02-02 09:13:26.31561+00', 'Batch 16:13:22 - Tầng', NULL, 'KHO_DONG_LANH', NULL),
	('b17ee901-be5a-475b-845f-562385428659', 'S.VT20', 20, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('24db3d62-70c7-4027-91bf-d36067b0b82e', 'S.VT22', 22, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('378792e5-0667-431a-bbf5-dff4e4290e5b', 'S.VT23', 23, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('d2e62990-abde-4f66-ac34-7054c7c746d2', 'S.VT24', 24, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('b6767e60-d0a8-4c4e-9f09-1a47c5f83ffb', 'S.VT25', 25, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('b46d5d42-6153-4c3b-869d-f20b6d308658', 'S.VT26', 26, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('5a42f0ed-3e13-4d8b-adfd-847de0478fce', 'S.VT27', 27, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('3a729449-1818-469f-8c4f-dc1988979742', 'S.VT28', 28, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('a033cf6c-8047-467e-9241-fd80ee223968', 'S.VT29', 29, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('9c4c0b48-b405-4d43-abc9-00055b7b7e14', 'S.VT30', 30, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('cd4446ff-544c-40eb-a35c-d05ed8e18ce1', 'S.VT18', 18, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('f47e2cec-add9-460b-831e-b2cc64777853', 'S.VT19', 19, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('bb642edd-4d7a-4d18-a6d7-34d6eb09a915', 'S.VT17', 17, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('e574ed9c-da4f-440d-978d-930f27bd2b71', 'S.VT16', 16, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('36021294-a68d-4b84-a5f0-fc0bf0723c8f', 'S.VT14', 14, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('47f18d9a-ca39-484d-a280-1f730339a7b0', 'S.VT13', 13, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('d9e7dacc-9793-4b7e-a718-2e42a65046aa', 'S.VT12', 12, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('5edcb1d3-9100-4076-80c9-6ffd292bb72d', 'S.VT11', 11, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('e3be45e8-f1e3-44b2-8160-439b65b996cf', 'S.VT6', 6, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL),
	('517f7577-9b04-4b42-89f6-372e9b2f057a', 'S.VT7', 7, '2026-02-01 06:47:44.029884+00', 'Batch 13:47:39 - Sảnh', NULL, 'KHO_DONG_LANH', NULL);


--
-- Data for Name: product_media; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."product_media" ("id", "created_at", "product_id", "url", "type", "sort_order", "company_id") VALUES
	('c264af29-e1f0-423d-a9b6-2262ca986082', '2026-01-31 18:10:35.298675+00', '269c147e-5470-49bc-b9e7-17d6bcc87ccd', 'https://drive.google.com/thumbnail?id=1BvrWnRz5GMn-jshZHbxNYqjHUE2pXWfV&sz=w1000', 'image', 0, 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0');


--
-- Data for Name: units; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."units" ("id", "created_at", "name", "description", "is_active", "system_code", "company_id") VALUES
	('d323e882-53c6-4c8f-8d45-e772dd77e933', '2026-01-30 07:47:18.65513+00', 'Kg', 'Kilogram', true, 'KHO_DONG_LANH', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('24f44605-4ffc-48e4-81b9-dffd944a074d', '2026-01-31 09:24:05.63017+00', 'Thùng', NULL, true, 'KHO_DONG_LANH', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('4f4b65b5-a2dc-43fc-be79-2d102bc27402', '2026-01-31 09:24:13.88139+00', 'Khay', NULL, true, 'KHO_DONG_LANH', 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0');


--
-- Data for Name: product_units; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."product_units" ("id", "product_id", "unit_id", "conversion_rate", "created_at", "ref_unit_id", "company_id") VALUES
	('7abd80dc-6070-43ad-9235-1716f654840a', '269c147e-5470-49bc-b9e7-17d6bcc87ccd', '24f44605-4ffc-48e4-81b9-dffd944a074d', 20, '2026-01-31 18:10:34.952593+00', NULL, 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('fbd09f2e-17c0-45eb-8e08-dd41f6293555', '124c83ea-9077-41e6-be89-d071bccebc02', '24f44605-4ffc-48e4-81b9-dffd944a074d', 20, '2026-02-01 17:43:10.753578+00', NULL, 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0'),
	('6574ff2f-7e4b-48f5-bd9a-d1935a1a4916', '6cbf26a4-a91a-4bcc-b033-e3c46373df63', '24f44605-4ffc-48e4-81b9-dffd944a074d', 20, '2026-02-01 17:54:50.792126+00', NULL, 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0');


--
-- Data for Name: vehicles; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: product_vehicle_compatibility; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profiles" ("id", "full_name", "role", "avatar_url", "updated_at") VALUES
	('1d502b01-df8b-4f27-9965-fa550a5b4096', NULL, 'staff', NULL, '2026-01-29 08:20:29.897603+00'),
	('9bbeaa84-90d9-4064-a692-c58724a6228b', 'HTX Trái Cây ABC', 'staff', NULL, '2026-01-30 07:47:19.277192+00'),
	('8560fd3f-170f-4c54-bba8-86cf8ea09699', NULL, 'staff', NULL, '2026-02-01 05:42:01.300813+00'),
	('a0ad4b7a-e0e5-42a0-bb06-4aa2b07c0018', NULL, 'staff', NULL, '2026-02-01 06:25:08.843934+00');


--
-- Data for Name: site_loans; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: systems; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."systems" ("code", "name", "description", "icon", "bg_color_class", "text_color_class", "is_active", "created_at", "modules", "sort_order", "company_id", "id", "inbound_modules", "outbound_modules", "dashboard_modules", "lot_modules", "hidden_menus") VALUES
	('KHO_BAO_BI', 'Kho Bao Bì', '', 'Package', 'bg-purple-600', 'text-purple-100', true, '2026-01-31 07:13:51.142132+00', '{"product_modules": ["images", "packaging"], "utility_modules": []}', 2, 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0', '9d57b349-d40b-47c7-8721-3a0ad5b96b8d', '{inbound_basic}', '{outbound_basic}', '{stats_overview}', '{warehouse_name,inbound_date}', '{}'),
	('KHO_DONG_LANH', 'Kho Đông Lạnh', '', 'Warehouse', 'bg-blue-600', 'text-blue-100', true, '2026-01-31 05:44:46.490353+00', '{"product_modules": ["packaging"], "utility_modules": ["utility_qr_assign", "auto_unbundle_lot", "lot_accounting_sync"]}', 1, 'fafad42a-6e4c-43a4-acc1-39b614ab9cd0', '3e772a37-8459-4306-89e4-ce9a760fe834', '{inbound_basic,inbound_type,inbound_financials}', '{outbound_basic}', '{stats_overview,categories_summary,recent_products}', '{warehouse_name,packaging_date,peeling_date,qc_info,extra_info}', '{vehicles,origins}');


--
-- Data for Name: zones; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."zones" ("id", "code", "name", "parent_id", "level", "created_at", "system_type", "company_id") VALUES
	('664a2277-50ef-49fe-8517-3b3e36d10205', 'SANH', 'Sảnh', NULL, 0, '2026-02-01 06:47:43.55525+00', 'KHO_DONG_LANH', NULL),
	('712bf152-536d-4468-b018-07cadfd6ddc9', 'TANG', 'Tầng', NULL, 0, '2026-02-02 09:13:25.809498+00', 'KHO_DONG_LANH', NULL);


--
-- Data for Name: zone_layouts; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."zone_layouts" ("id", "zone_id", "position_columns", "cell_width", "cell_height", "child_layout", "child_columns", "child_width", "collapsible", "created_at", "updated_at", "display_type", "company_id") VALUES
	('f3e68119-24c6-4e25-9555-a0ffb9223aff', '664a2277-50ef-49fe-8517-3b3e36d10205', 5, 0, 200, 'vertical', 0, 0, true, '2026-02-01 06:48:18.126254+00', '2026-02-01 06:48:35.388+00', 'auto', NULL);


--
-- Data for Name: zone_positions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."zone_positions" ("id", "position_id", "zone_id", "created_at") VALUES
	('c597fa92-c674-4481-ae6e-491996f06d54', '3bce6107-1467-4f49-9850-628902014a6a', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('3ac3b65d-163b-4ad4-84c7-7d40537ab0bc', '0ee76653-6a35-4470-b479-0b8934e818ee', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('370aabcf-fbbd-45d0-a0d2-d70d1cdda915', '60afbc3a-c3bc-4a1e-a60e-524f01ecbc50', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('3845b8bd-7f86-4a98-8074-038192e9848f', '46ada4a1-6c1d-4281-8fdf-cd3eaef34bf7', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('c6ea4928-fbd8-4e0c-b640-c6da3333b3ac', '910fb45c-dd30-4492-852d-bcfefa26afb7', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('ee188b5c-c02e-4b9c-bfdd-4c0bf26b61e9', 'e3be45e8-f1e3-44b2-8160-439b65b996cf', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('d2f00d46-8161-4912-bd8a-df18a751a094', '517f7577-9b04-4b42-89f6-372e9b2f057a', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('3df8d372-2f4a-4104-9d3b-cf6e1ff3a80c', '395e69e1-b080-4ab9-9a1c-3999ed70fd54', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('6b7e743d-119f-4190-86ff-bdc3e623e2b0', '09383cff-c508-4a25-8ff0-01db493237e9', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('8c4eb4a9-aa31-4171-bc78-7e9f82a9af15', '872ba1d1-11d6-44ad-b5d1-dbcd8dd7a95f', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('b3947247-644a-4f58-8f0a-d32a7ec42074', '5edcb1d3-9100-4076-80c9-6ffd292bb72d', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('fcc576b9-c58c-4938-bb88-085164f7dde2', 'd9e7dacc-9793-4b7e-a718-2e42a65046aa', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('c156f913-c14b-4823-b6da-e9df26578f08', '47f18d9a-ca39-484d-a280-1f730339a7b0', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('f161dd04-c7ce-46a8-a09e-851b1541e64e', '36021294-a68d-4b84-a5f0-fc0bf0723c8f', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('fcbbb6a0-f59f-4258-ae0e-fb10434cd6f0', 'bc4d2df7-b0a3-4396-a6f8-e919e6e619a4', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('3b8558bc-caf7-4aa4-8e53-2637272808ad', 'e574ed9c-da4f-440d-978d-930f27bd2b71', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('1598d3c2-655d-456e-8f5a-f48fd90ff1fb', 'bb642edd-4d7a-4d18-a6d7-34d6eb09a915', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('bea096d6-d8ed-461a-8c58-65a82554c582', 'cd4446ff-544c-40eb-a35c-d05ed8e18ce1', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('58323b85-4764-4f41-b361-069f23ef7ae8', 'f47e2cec-add9-460b-831e-b2cc64777853', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('cf56da02-407b-4121-8861-937ca5d7903d', 'b17ee901-be5a-475b-845f-562385428659', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('97ab5edb-2c20-43ea-9eb2-2ce704233c79', '092da9c4-c62c-4562-a2a9-6a1a4ab60464', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('2addcd24-44b0-48bb-a83e-0cd5169c160d', '24db3d62-70c7-4027-91bf-d36067b0b82e', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('d6756559-1d0a-4733-96e2-8e7f11f1f829', '378792e5-0667-431a-bbf5-dff4e4290e5b', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('7e26fc04-4779-499f-b972-f49bb496fc04', 'd2e62990-abde-4f66-ac34-7054c7c746d2', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('32a4aedb-c726-45ac-8685-28074bcf86b3', 'b6767e60-d0a8-4c4e-9f09-1a47c5f83ffb', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('4211a87a-d75f-4b59-957e-e799ac096fc1', 'b46d5d42-6153-4c3b-869d-f20b6d308658', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('aec760ef-40be-4c27-b857-32f2c33bea88', '5a42f0ed-3e13-4d8b-adfd-847de0478fce', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('91ab1252-89c5-4747-b862-01fda83c688d', '3a729449-1818-469f-8c4f-dc1988979742', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('78a9b75e-8515-4b85-a71a-275064fccdd2', 'a033cf6c-8047-467e-9241-fd80ee223968', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('0f0773ea-c12d-4689-b51b-ab035951343c', '9c4c0b48-b405-4d43-abc9-00055b7b7e14', '664a2277-50ef-49fe-8517-3b3e36d10205', '2026-02-01 06:47:44.973933+00'),
	('6bc437c2-56cc-4570-abf8-63560c7bbefd', '38cf3803-b4e3-4f42-be0f-f265c1b53fdc', '712bf152-536d-4468-b018-07cadfd6ddc9', '2026-02-02 09:13:27.308658+00'),
	('e2577deb-cbb8-47a1-a9af-c7a8f54a3885', '2ce40db1-68ce-4b91-8c78-c267866f4f89', '712bf152-536d-4468-b018-07cadfd6ddc9', '2026-02-02 09:13:27.308658+00'),
	('223fe896-c585-4261-8a32-fc38db352af6', '500088eb-5028-4780-83f7-270ccb6015a9', '712bf152-536d-4468-b018-07cadfd6ddc9', '2026-02-02 09:13:27.308658+00'),
	('a22a8833-5fa4-45da-829c-004546aeac0f', 'b46104d3-4ca5-47da-891e-c1d47196aa27', '712bf152-536d-4468-b018-07cadfd6ddc9', '2026-02-02 09:13:27.308658+00'),
	('786a7624-4bc7-4e12-b831-fadf82ac54ef', 'b5ad6e49-519a-46ef-8b66-df8babacf3f5', '712bf152-536d-4468-b018-07cadfd6ddc9', '2026-02-02 09:13:27.308658+00'),
	('1c3d68e9-73cd-429c-a8ee-ab4d58a32c8d', '425760b5-cfd9-4b05-9cf2-780de881c405', '712bf152-536d-4468-b018-07cadfd6ddc9', '2026-02-02 09:13:27.308658+00'),
	('0fefb135-7665-4c30-adad-ef55bee829d4', 'd742cd37-0728-4d98-81fd-eb03c373d8b8', '712bf152-536d-4468-b018-07cadfd6ddc9', '2026-02-02 09:13:27.308658+00'),
	('4386ece6-d4fb-4c96-8d4b-8df8bb496619', '0c754686-0dda-4049-9d71-f8ad14f45db8', '712bf152-536d-4468-b018-07cadfd6ddc9', '2026-02-02 09:13:27.308658+00'),
	('6033a1b0-5077-453a-bcc5-635c8209f240', '391717a6-4b6b-47fe-9f0e-77edcff11874', '712bf152-536d-4468-b018-07cadfd6ddc9', '2026-02-02 09:13:27.308658+00'),
	('0b8aa22e-8fe1-4513-8448-3abb3fee9386', 'c2e2a57a-c1a1-46e6-b4f5-a6efdb3a7ca2', '712bf152-536d-4468-b018-07cadfd6ddc9', '2026-02-02 09:13:27.308658+00'),
	('53c3cc57-27b3-46c7-867d-48504dc36f34', '0d9f0fb6-e665-45cc-aac0-c164e23efb4a', '712bf152-536d-4468-b018-07cadfd6ddc9', '2026-02-02 09:13:27.308658+00'),
	('52ebd73b-090c-4190-8726-2a7cd887f551', 'eee867e2-9cdd-4830-bb95-6ae32ee8f4fe', '712bf152-536d-4468-b018-07cadfd6ddc9', '2026-02-02 09:13:27.308658+00'),
	('9df7e993-3edd-4d78-bc19-ef753f4615a9', '2d1f5350-0756-4f36-af0e-65c9d2f9f16e', '712bf152-536d-4468-b018-07cadfd6ddc9', '2026-02-02 09:13:27.308658+00'),
	('2ff3820a-0fd6-4441-b039-72b8a5ef70b6', 'f4d765c4-f170-4f78-b54b-34a07bf5c81d', '712bf152-536d-4468-b018-07cadfd6ddc9', '2026-02-02 09:13:27.308658+00'),
	('6748880e-f0ff-4c9b-a922-82be3fd03a5a', '908e5631-899d-4331-8170-77372483a1a0', '712bf152-536d-4468-b018-07cadfd6ddc9', '2026-02-02 09:13:27.308658+00'),
	('5a036c79-88c3-4242-b936-b07599ae9671', '8afb6661-c6b3-4232-bf92-958948ceb1d3', '712bf152-536d-4468-b018-07cadfd6ddc9', '2026-02-02 09:13:27.308658+00'),
	('17cd3d31-d5c4-4b04-be53-9a21a3e3caac', '958f49a1-7db3-471a-934c-23369c694252', '712bf152-536d-4468-b018-07cadfd6ddc9', '2026-02-02 09:13:27.308658+00'),
	('4255b292-ec50-4a8d-8537-fea93331c99f', 'f281997d-0eb9-4925-a6b2-9c9dc2fa16f4', '712bf152-536d-4468-b018-07cadfd6ddc9', '2026-02-02 09:13:27.308658+00'),
	('7b351d34-1e48-41f6-94c8-ba7c8c7bd1be', '50626555-956e-41a3-8524-f1f37af379fc', '712bf152-536d-4468-b018-07cadfd6ddc9', '2026-02-02 09:13:27.308658+00'),
	('e2f02506-a503-4544-a959-21cf89c7b389', 'd34dbe4a-62c2-46dd-9fd6-9261449c4a78', '712bf152-536d-4468-b018-07cadfd6ddc9', '2026-02-02 09:13:27.308658+00');


--
-- Data for Name: zone_status_layouts; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: zone_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES
	('note-attachments', 'note-attachments', NULL, '2026-01-27 17:12:48.932581+00', '2026-01-27 17:12:48.932581+00', true, false, NULL, NULL, NULL, 'STANDARD'),
	('company-assets', 'company-assets', NULL, '2026-01-16 12:55:56.744196+00', '2026-01-16 12:55:56.744196+00', true, false, NULL, NULL, NULL, 'STANDARD');


--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."objects" ("id", "bucket_id", "name", "owner", "created_at", "updated_at", "last_accessed_at", "metadata", "version", "owner_id", "user_metadata", "level") VALUES
	('b6e2e052-1197-40d5-bcd1-362ef0884a16', 'company-assets', '.emptyFolderPlaceholder', NULL, '2026-01-29 05:33:42.799539+00', '2026-01-29 05:33:42.799539+00', '2026-01-29 05:33:42.799539+00', '{"eTag": "\"d41d8cd98f00b204e9800998ecf8427e\"", "size": 0, "mimetype": "application/octet-stream", "cacheControl": "max-age=3600", "lastModified": "2026-01-29T05:33:42.845Z", "contentLength": 0, "httpStatusCode": 200}', '7b97a311-4cef-40e9-86eb-869576226113', NULL, '{}', 1),
	('53ecd52e-8c29-412b-a976-8fe5cbe5f7d5', 'company-assets', 'logo_1769677914852.png', 'd2ec7e53-1b9c-4b2c-9030-b92e2657b44d', '2026-01-29 09:11:55.81339+00', '2026-01-29 09:11:55.81339+00', '2026-01-29 09:11:55.81339+00', '{"eTag": "\"e1fa5860ec634da47a499fb3529a977a\"", "size": 89430, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-01-29T09:11:56.000Z", "contentLength": 89430, "httpStatusCode": 200}', '2f1b1e68-b8b5-4b1a-a655-ce13d216e0e9', 'd2ec7e53-1b9c-4b2c-9030-b92e2657b44d', '{}', 1),
	('2541be84-e0d4-49c3-9fa6-0dc98e783d7b', 'company-assets', 'logo_1769678502651.png', 'd2ec7e53-1b9c-4b2c-9030-b92e2657b44d', '2026-01-29 09:21:43.71007+00', '2026-01-29 09:21:43.71007+00', '2026-01-29 09:21:43.71007+00', '{"eTag": "\"e1fa5860ec634da47a499fb3529a977a\"", "size": 89430, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-01-29T09:21:44.000Z", "contentLength": 89430, "httpStatusCode": 200}', 'd13a512f-904a-41b1-a14f-cf8b11f3bc5b', 'd2ec7e53-1b9c-4b2c-9030-b92e2657b44d', '{}', 1),
	('ff040019-a2bf-4080-ba8c-6b91e0337e27', 'company-assets', 'logo_1769678727632.png', 'd2ec7e53-1b9c-4b2c-9030-b92e2657b44d', '2026-01-29 09:25:28.372829+00', '2026-01-29 09:25:28.372829+00', '2026-01-29 09:25:28.372829+00', '{"eTag": "\"e1fa5860ec634da47a499fb3529a977a\"", "size": 89430, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-01-29T09:25:29.000Z", "contentLength": 89430, "httpStatusCode": 200}', 'da772551-3776-4861-aa66-daf60deaead0', 'd2ec7e53-1b9c-4b2c-9030-b92e2657b44d', '{}', 1),
	('a76bd63d-7e22-48e9-83a8-5dc485d3f52e', 'company-assets', 'logo_1769678913947.png', 'd2ec7e53-1b9c-4b2c-9030-b92e2657b44d', '2026-01-29 09:28:34.963352+00', '2026-01-29 09:28:34.963352+00', '2026-01-29 09:28:34.963352+00', '{"eTag": "\"e1fa5860ec634da47a499fb3529a977a\"", "size": 89430, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-01-29T09:28:35.000Z", "contentLength": 89430, "httpStatusCode": 200}', '4e758b6a-ab99-482a-b407-4573145e989f', 'd2ec7e53-1b9c-4b2c-9030-b92e2657b44d', '{}', 1);


--
-- Data for Name: prefixes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 576, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict rEX3D92MNpap4sg3ZfRRfRfLou5w7BwnCuW37TueXvy4b0YOuRg1KfrY9Mr0qSO

RESET ALL;
