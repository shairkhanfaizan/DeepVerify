import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

USER_ID = "feb62e91-a9bb-4dfc-9861-af8680afa06e" # faizan@deepverify.io
POLICY_ID = "9fdf446d-a593-4981-92d9-44f4af83db44"

# 1. Update Existing Cases with Professional Titles, Notes & Clean Dates
EXISTING_CASE_UPDATES = {
    # 84e7dcbb
    "84e7dcbb-7721-46e6-a2a1-926fc266cdd0": {
        "title": "Viral Social Media Campaign — Celebrity Portrait Manipulation",
        "notes": "Forensic audit requested to verify authenticity of alleged viral paparazzi close-up spreading on social media.",
        "dt": datetime(2026, 10, 6, 11, 20, 0, tzinfo=timezone.utc),
        "photos": {
            "a3c4fb20-d328-4455-830a-550a88acb28c": "Celebrity_RedCarpet_Viral_Claim.jpg",
            "9620ea7f-74ac-4c7c-9b0e-41f6e4d302cf": "CloseUp_SkinTexture_Artifacts.jpg",
        }
    },
    # ff837f21
    "ff837f21-4886-4285-a6ee-07b8187e5cdf": {
        "title": "Corporate Press Wire — Executive Profile Authenticity Check",
        "notes": "Media verification desk checking executive headshot accompanying corporate press release.",
        "dt": datetime(2026, 10, 7, 14, 15, 0, tzinfo=timezone.utc),
        "photos": {
            "9a2939e4-b534-4b8e-8b7b-2cab8416521b": "Executive_AnnualReport_Headshot.jpg",
        }
    },
    # e9ae274a
    "e9ae274a-eb89-465c-b1f1-c87124057b36": {
        "title": "Political Rally Broadcast — Stage Keyframe Integrity Audit",
        "notes": "Verification of multi-angle broadcast keyframes from prime time campaign event.",
        "dt": datetime(2026, 10, 8, 9, 30, 0, tzinfo=timezone.utc),
        "photos": {
            "ff24a6a6-efc6-4bdc-b4ca-bc50f6fde20a": "Candidate_Podium_PrimaryAngle.jpg",
            "06ca6339-6c58-4f2c-8348-080563f931c7": "Press_Gallery_WideView.jpg",
            "ffdd01df-7a0f-43c8-98ce-2a6549a25d69": "Verified_Broadcast_Source.jpg",
        }
    },
    # 3d1eb13a
    "3d1eb13a-9f1b-4d22-b6ff-ce3540812c9b": {
        "title": "Election Misinformation Watch — Public Figure Quote Card",
        "notes": "Analysis of synthetic quote card image distributed across messaging channels.",
        "dt": datetime(2026, 10, 8, 16, 45, 0, tzinfo=timezone.utc),
        "photos": {
            "49143193-13e7-42a5-8509-486770c5200b": "Social_Media_QuoteCard_Graphic.png",
        }
    },
    # 8d8adc4e
    "8d8adc4e-3c0f-44d1-9fc1-4029c8c59664": {
        "title": "Synthetic Identity Fraud — Virtual Persona Verification",
        "notes": "Inquiry regarding suspicious freelance account avatar exhibiting AI generative characteristics.",
        "dt": datetime(2026, 10, 9, 10, 10, 0, tzinfo=timezone.utc),
        "photos": {
            "512a05f5-5929-476c-b1f9-ae29f2b39f9e": "Freelance_Profile_Avatar_Inspection.png",
        }
    },
    # 4f25d2dc
    "4f25d2dc-c2aa-4f35-9c99-a18a7788bdd7": {
        "title": "Breaking News Photojournalism — Unverified Conflict Image",
        "notes": "Validation of citizen journalist crowd image compared to accredited agency wire archives.",
        "dt": datetime(2026, 10, 9, 15, 20, 0, tzinfo=timezone.utc),
        "photos": {
            "216a5ad9-9579-4cff-8397-ecb52c461d45": "Citizen_Journalist_Crowd_Frame.jpg",
            "ada11a8f-c930-4b65-9f22-fca37ec2093c": "Agency_Wire_Verified_Reference.jpg",
        }
    },
    # 566c58b2
    "566c58b2-4c0e-4fdc-9b24-14b5ddad3168": {
        "title": "Fast-Track Forensic Verification — Viral Telegram Leak",
        "notes": "Rapid spatial and frequency screening on leaked conference attendee image.",
        "dt": datetime(2026, 10, 10, 8, 45, 0, tzinfo=timezone.utc),
        "photos": {
            "b3c95c1d-afdb-4392-848c-6ad4416946bf": "Telegram_Group_Forwarded_Photo.jpg",
        }
    },
    # 3e724c5a
    "3e724c5a-a5b5-4a26-8df2-2cf0e54820eb": {
        "title": "High-Resolution Headshot Inspection — AI Diffusion Check",
        "notes": "Evaluation of badge photograph for biometric and synthetic anomaly markers.",
        "dt": datetime(2026, 10, 10, 11, 30, 0, tzinfo=timezone.utc),
        "photos": {
            "992d2771-f02a-462f-9a20-037544a89f5a": "Conference_Attendee_Badge_Photo.jpg",
        }
    },
    # 3bf99180
    "3bf99180-af44-45ac-94ee-bf139851010a": {
        "title": "Media Verification Desk — Influencer Brand Collab Image",
        "notes": "Commercial authenticity audit for outdoor sponsorship promotional graphic.",
        "dt": datetime(2026, 10, 10, 14, 15, 0, tzinfo=timezone.utc),
        "photos": {
            "a10637c2-716d-4af3-979c-cdbe246ac489": "Brand_Ambassador_Outdoor_Promo.jpg",
        }
    },
    # 8e365626
    "8e365626-9570-4ac9-a52a-b02f14c770a3": {
        "title": "Comprehensive Media Dossier — Multimodal Consistency Analysis",
        "notes": "Full multi-evidence investigative case combining real camera captures and synthetic face-swap variations.",
        "dt": datetime(2026, 10, 11, 11, 0, 0, tzinfo=timezone.utc),
        "photos": {
            "1b91d8ce-ba84-4900-b573-9a3d9c6c49cb": "TikTok_Keyframe_Artifacts.jpg",
            "7a999313-b0fd-4615-aafe-312f7eacffee": "Facial_Contour_Irregularity.jpg",
            "d160065d-8ae5-47be-950a-6ad2781b05fa": "Original_Press_Photo_Archived.jpg",
            "739b4ecb-d296-4994-bf07-a35389516ab3": "GAN_Generated_Alternative_Angle.jpg",
            "cb7a58ef-a99d-47a6-a879-49b4669bdd03": "High_Resolution_SLR_Capture.jpg",
            "25f76c8d-cc66-422a-b35c-f2dd2909c5f7": "Photographer_Master_Raw_File.jpg",
            "ed3f6fad-72aa-4789-a5d6-95acc01d6647": "Deepfake_FaceSwap_Synthetic_Layer.jpg",
        }
    },
    # df73012e
    "df73012e-298b-444c-82d1-98838529f11c": {
        "title": "Athlete Endorsement Dispute — Comparison Study",
        "notes": "Direct comparison between official sponsor campaign asset and alleged altered portrait.",
        "dt": datetime(2026, 10, 12, 10, 20, 0, tzinfo=timezone.utc),
        "photos": {
            "578d176f-085f-43af-b1e2-28c9c68c7492": "Official_Sponsor_Campaign_Banner.jpg",
            "027e5e33-858c-4bd5-9f9b-e2c6354c832b": "Alex_Viral_Athlete_Alleged_Swap.jpg",
        }
    },
    # 260f6301
    "260f6301-dd10-4d9a-b9e8-d3564b68a0f9": {
        "title": "Academic Research Series — Diffusion Artifacts Benchmarking",
        "notes": "Testing sensitivity across Midjourney v6, FLUX, and Stable Diffusion latent representations.",
        "dt": datetime(2026, 10, 12, 16, 45, 0, tzinfo=timezone.utc),
        "photos": {
            "df0814ec-21e8-49c6-9988-bf8c762c25d2": "Midjourney_v6_Photorealistic_Test.png",
            "fcc3f587-e140-4aa8-9470-2a032b5627e4": "FLUX_Model_HighDetail_Output.png",
            "5b2138c0-e321-415d-bc70-380e6092381c": "StableDiffusion_XL_Facial_Generation.png",
        }
    },
    # 901a216a
    "901a216a-bd88-4f30-9f1c-0ddfb64d676d": {
        "title": "Famous Athlete — Live Verification Case",
        "notes": "Active verification case opened during presentation demo for real-time forensic scanning.",
        "dt": datetime(2026, 10, 13, 15, 34, 0, tzinfo=timezone.utc),
        "photos": {
            "edbbbcee-ff51-4bdb-b3e3-f4ab779cc0c1": "Famous_Athlete_Alex_Profile.jpg",
        }
    },
}

# 2. Complete pending/uploaded evidence items with realistic analysis
COMPLETED_PATCHES = {
    "06ca6339-6c58-4f2c-8348-080563f931c7": {
        "score": 0.885,
        "verdict": "LIKELY_AUTHENTIC",
        "heatmap": "storage/heatmap_11eeb4cec4c64e67a71ad95cd543980f.png",
    },
    "ada11a8f-c930-4b65-9f22-fca37ec2093c": {
        "score": 0.942,
        "verdict": "LIKELY_AUTHENTIC",
        "heatmap": "storage/heatmap_12bab0a328a64310a7c7f64af89e6482.png",
    },
    "027e5e33-858c-4bd5-9f9b-e2c6354c832b": {
        "score": 0.021,
        "verdict": "LIKELY_AI_GENERATED",
        "heatmap": "storage/heatmap_142563e4c56a4350a46200844dc585b3.png",
    },
}

# 3. New Historical Cases from Oct 2 to Oct 5
NEW_HISTORICAL_CASES = [
    {
        "title": "Foundational Calibration — Camera Sensor Baseline Check",
        "notes": "Initial platform validation and baseline calibration using authentic sensor captures and diffusion test samples.",
        "created_at": datetime(2026, 10, 2, 10, 15, 0, tzinfo=timezone.utc),
        "photos": [
            {
                "file_hash": "c155655b7ecde76b6c45f45f6678c4d37b501b2b78f554b10f7566f60440a998",
                "storage_key": "storage/00025.jpg.jpg",
                "name": "Reference_SLR_Natural_Lighting.jpg",
                "score": 0.985,
                "verdict": "LIKELY_AUTHENTIC",
                "heatmap": "storage/heatmap_3f95452f6bb14d689881c6af21bfb935.png",
                "dimensions": "256x256",
            },
            {
                "file_hash": "8a878d1a92b9efe2148fc07c050f899098d6a96b0f265510b9da0f1a6ca488f5",
                "storage_key": "storage/0ARJBWDKA1.jpg.jpg",
                "name": "Synthetic_Diffusion_Benchmark_01.jpg",
                "score": 0.015,
                "verdict": "LIKELY_AI_GENERATED",
                "heatmap": "storage/heatmap_3596fab180ee46bd9eba3d613b7e7a73.png",
                "dimensions": "256x256",
            }
        ]
    },
    {
        "title": "Financial News Desk — International Trade Summit Photo Check",
        "notes": "Forensic verification requested by media desk for unverified press photo submitted via news wire.",
        "created_at": datetime(2026, 10, 3, 14, 30, 0, tzinfo=timezone.utc),
        "photos": [
            {
                "file_hash": "c4ad0614b8952d4434871ca4eb01f7b7dbbc8eced09dad3e3c861536ccd955fd",
                "storage_key": "storage/00010.jpg.jpg",
                "name": "Summit_Delegation_Signing_Table.jpg",
                "score": 0.978,
                "verdict": "LIKELY_AUTHENTIC",
                "heatmap": "storage/heatmap_41886086c3274fbb88cf5565c15597be.png",
                "dimensions": "256x256",
            }
        ]
    },
    {
        "title": "Social Media Crisis Response — Fake Disaster Imagery Audit",
        "notes": "Analysis of synthetic flood damage photo spreading rapidly on social channels during severe storm warning.",
        "created_at": datetime(2026, 10, 4, 11, 0, 0, tzinfo=timezone.utc),
        "photos": [
            {
                "file_hash": "451d51b8b34afbc7035a99a8efb704bbde07f0cab621867c36017848d950ab13",
                "storage_key": "storage/0A266M95TD.jpg.jpg",
                "name": "Flood_Zone_Aerial_Post.jpg",
                "score": 0.045,
                "verdict": "LIKELY_AI_GENERATED",
                "heatmap": "storage/heatmap_429304197d94499c96733043eaa6e958.png",
                "dimensions": "256x256",
            },
            {
                "file_hash": "df6c30b16e2523277d7288a5edb71914500f8214106987f13356036c01ff7db2",
                "storage_key": "storage/00003.jpg.jpg",
                "name": "Satellite_Ground_Truth_Compare.jpg",
                "score": 0.942,
                "verdict": "LIKELY_AUTHENTIC",
                "heatmap": "storage/heatmap_6954bc59ad5a4d6090f16fa0ed691913.png",
                "dimensions": "256x256",
            }
        ]
    },
    {
        "title": "Identity Theft Investigation — Fake Government ID Portrait",
        "notes": "Synthetic passport photo inspection submitted for forensic screening during credential audit.",
        "created_at": datetime(2026, 10, 5, 16, 20, 0, tzinfo=timezone.utc),
        "photos": [
            {
                "file_hash": "83fc772c216f55369688524eded69100114a1db9f17255fa8494309a31136b55",
                "storage_key": "storage/0AZIV8J8A7.jpg.jpg",
                "name": "Passport_Applicant_Scan_Artifact.jpg",
                "score": 0.012,
                "verdict": "LIKELY_AI_GENERATED",
                "heatmap": "storage/heatmap_e315d7992a7247c5b38c80f67b19869c.png",
                "dimensions": "256x256",
            }
        ]
    }
]

async def seed():
    engine = create_async_engine("postgresql+asyncpg://deepverify:deepverify_password@localhost:5432/deepverify_v2")
    async with engine.begin() as conn:
        print("[1/4] Updating existing 13 cases with clean titles, notes & timestamps...")
        for case_id, info in EXISTING_CASE_UPDATES.items():
            await conn.execute(
                text("UPDATE investigations SET title = :title, notes = :notes, created_at = :dt, updated_at = :dt WHERE id = :id"),
                {"id": case_id, "title": info["title"], "notes": info["notes"], "dt": info["dt"]}
            )
            # Update photo names & dates
            for ev_id, photo_name in info["photos"].items():
                ev_dt = info["dt"] + timedelta(minutes=5)
                await conn.execute(
                    text("UPDATE evidence_items SET created_at = :dt WHERE id = :id"),
                    {"id": ev_id, "dt": ev_dt}
                )
                # Check if observation exists
                obs_res = await conn.execute(
                    text("SELECT id FROM evidence_observations WHERE evidence_id = :ev_id AND signal_type = 'ORIGINAL_FILENAME'"),
                    {"ev_id": ev_id}
                )
                obs_row = obs_res.fetchone()
                if obs_row:
                    await conn.execute(
                        text("UPDATE evidence_observations SET value = :val, representation = :rep WHERE id = :id"),
                        {"id": obs_row[0], "val": photo_name, "rep": f"Photo Name: {photo_name}"}
                    )
                else:
                    await conn.execute(
                        text("""INSERT INTO evidence_observations (id, evidence_id, signal_type, value, representation, provenance, created_at)
                                VALUES (:id, :ev_id, 'ORIGINAL_FILENAME', :val, :rep, 'User Input', :dt)"""),
                        {"id": str(uuid.uuid4()), "ev_id": ev_id, "val": photo_name, "rep": f"Photo Name: {photo_name}", "dt": ev_dt}
                    )

        print("[2/4] Patching pending evidence items to COMPLETED status...")
        for ev_id, patch in COMPLETED_PATCHES.items():
            await conn.execute(
                text("UPDATE evidence_items SET status = 'COMPLETED' WHERE id = :id"),
                {"id": ev_id}
            )
            # Check if analysis result exists
            ar_res = await conn.execute(
                text("SELECT id FROM analysis_results WHERE evidence_id = :ev_id"),
                {"ev_id": ev_id}
            )
            ar_row = ar_res.fetchone()
            if ar_row:
                await conn.execute(
                    text("UPDATE analysis_results SET verdict = :verdict, ensemble_score = :score, ai_explanation = :hm WHERE id = :id"),
                    {"id": ar_row[0], "verdict": patch["verdict"], "score": patch["score"], "hm": patch["heatmap"]}
                )
            else:
                await conn.execute(
                    text("""INSERT INTO analysis_results (id, evidence_id, policy_id, verdict, ensemble_score, ai_explanation, created_at)
                            VALUES (:id, :ev_id, :policy_id, :verdict, :score, :hm, NOW())"""),
                    {
                        "id": str(uuid.uuid4()),
                        "ev_id": ev_id,
                        "policy_id": POLICY_ID,
                        "verdict": patch["verdict"],
                        "score": patch["score"],
                        "hm": patch["heatmap"],
                    }
                )

        print("[3/4] Inserting 4 historical cases from Oct 2 to Oct 5...")
        for case in NEW_HISTORICAL_CASES:
            case_id = str(uuid.uuid4())
            await conn.execute(
                text("""INSERT INTO investigations (id, user_id, title, notes, status, created_at, updated_at)
                        VALUES (:id, :uid, :title, :notes, 'OPEN', :dt, :dt)"""),
                {"id": case_id, "uid": USER_ID, "title": case["title"], "notes": case["notes"], "dt": case["created_at"]}
            )

            for p_idx, p in enumerate(case["photos"]):
                ev_id = str(uuid.uuid4())
                ev_dt = case["created_at"] + timedelta(minutes=5 + p_idx * 3)
                await conn.execute(
                    text("""INSERT INTO evidence_items (id, investigation_id, file_hash, mime_type, storage_key, status, created_at)
                            VALUES (:id, :inv_id, :hash, 'image/jpeg', :skey, 'COMPLETED', :dt)"""),
                    {"id": ev_id, "inv_id": case_id, "hash": p["file_hash"], "skey": p["storage_key"], "dt": ev_dt}
                )
                # Observations
                await conn.execute(
                    text("""INSERT INTO evidence_observations (id, evidence_id, signal_type, value, representation, provenance, created_at)
                            VALUES (:id, :ev_id, 'ORIGINAL_FILENAME', :val, :rep, 'User Input', :dt)"""),
                    {"id": str(uuid.uuid4()), "ev_id": ev_id, "val": p["name"], "rep": f"Photo Name: {p['name']}", "dt": ev_dt}
                )
                await conn.execute(
                    text("""INSERT INTO evidence_observations (id, evidence_id, signal_type, value, representation, provenance, created_at)
                            VALUES (:id, :ev_id, 'IMAGE_FORMAT', 'JPEG', 'Format: JPEG', 'Metadata Extraction', :dt)"""),
                    {"id": str(uuid.uuid4()), "ev_id": ev_id, "dt": ev_dt}
                )
                await conn.execute(
                    text("""INSERT INTO evidence_observations (id, evidence_id, signal_type, value, representation, provenance, created_at)
                            VALUES (:id, :ev_id, 'IMAGE_DIMENSIONS', :val, 'Dimensions: 256x256', 'Metadata Extraction', :dt)"""),
                    {"id": str(uuid.uuid4()), "ev_id": ev_id, "val": p["dimensions"], "dt": ev_dt}
                )
                # Signals
                await conn.execute(
                    text("""INSERT INTO evidence_signals (id, evidence_id, signal_type, value, confidence_semantics, model_id, model_version, provenance, created_at)
                            VALUES (:id, :ev_id, 'SPATIAL_PROBABILITY_REAL', :val, 'AI_PROBABILITY', 'deepverify-spatial-v1', '1.0', 'deepverify-spatial-v1', :dt)"""),
                    {"id": str(uuid.uuid4()), "ev_id": ev_id, "val": str(round(p["score"], 4)), "dt": ev_dt}
                )
                await conn.execute(
                    text("""INSERT INTO evidence_signals (id, evidence_id, signal_type, value, confidence_semantics, model_id, model_version, provenance, created_at)
                            VALUES (:id, :ev_id, 'FREQUENCY_PROBABILITY_REAL', :val, 'AI_PROBABILITY', 'deepverify-frequency-v1', '1.0', 'deepverify-frequency-v1', :dt)"""),
                    {"id": str(uuid.uuid4()), "ev_id": ev_id, "val": str(round(p["score"] * 0.95, 4)), "dt": ev_dt}
                )
                # Analysis Result
                await conn.execute(
                    text("""INSERT INTO analysis_results (id, evidence_id, policy_id, verdict, ensemble_score, ai_explanation, created_at)
                            VALUES (:id, :ev_id, :pol_id, :verdict, :score, :hm, :dt)"""),
                    {
                        "id": str(uuid.uuid4()),
                        "ev_id": ev_id,
                        "pol_id": POLICY_ID,
                        "verdict": p["verdict"],
                        "score": p["score"],
                        "hm": p["heatmap"],
                        "dt": ev_dt
                    }
                )

        print("[4/4] Done! All cases and photos successfully updated and backdated from Oct 2!")

if __name__ == "__main__":
    asyncio.run(seed())
