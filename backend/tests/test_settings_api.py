import pytest
from app.core.config import settings


@pytest.mark.asyncio
async def test_get_settings(client):
    response = await client.get("/api/v1/settings")
    assert response.status_code == 200
    data = response.json()
    assert "sampling_rate_fps" in data
    assert "confidence_threshold" in data
    assert "weapon_confidence_threshold" in data
    assert "weapon_consecutive_frames" in data
    assert "event_cooldown_seconds" in data
    assert "inference_device" in data
    assert "model_name" in data
    assert "database_engine" in data


@pytest.mark.asyncio
async def test_update_settings_and_reset(client):
    # Update settings
    payload = {
        "sampling_rate_fps": 8,
        "confidence_threshold": 0.35,
        "weapon_confidence_threshold": 0.40,
        "weapon_consecutive_frames": 3,
        "event_cooldown_seconds": 15
    }
    response = await client.put("/api/v1/settings", json=payload)
    assert response.status_code == 200
    updated = response.json()
    assert updated["sampling_rate_fps"] == 8
    assert updated["confidence_threshold"] == 0.35
    assert updated["weapon_confidence_threshold"] == 0.40
    assert updated["weapon_consecutive_frames"] == 3
    assert updated["event_cooldown_seconds"] == 15

    # Verify config changed
    assert settings.SAMPLING_RATE_FPS == 8
    assert settings.CONFIDENCE_THRESHOLD == 0.35

    # Reset back to defaults
    reset_resp = await client.post("/api/v1/settings/reset")
    assert reset_resp.status_code == 200
    reset_data = reset_resp.json()
    assert reset_data["sampling_rate_fps"] == 5
    assert reset_data["confidence_threshold"] == 0.25
    assert settings.SAMPLING_RATE_FPS == 5
    assert settings.CONFIDENCE_THRESHOLD == 0.25


@pytest.mark.asyncio
async def test_update_settings_validation(client):
    # Invalid sampling rate (out of range)
    response = await client.put("/api/v1/settings", json={"sampling_rate_fps": 100})
    assert response.status_code == 422

    # Invalid confidence threshold
    response = await client.put("/api/v1/settings", json={"confidence_threshold": 1.5})
    assert response.status_code == 422
