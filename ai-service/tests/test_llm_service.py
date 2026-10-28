import pytest

from services import llm_service


def test_vertex_configuration_accepts_standard_gcp_names(monkeypatch):
    monkeypatch.delenv("GOOGLE_CREDENTIAL_FILE", raising=False)
    monkeypatch.delenv("PROJECT_ID", raising=False)
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", "/tmp/render-gcp.json")
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "resqai-production")

    assert llm_service._vertex_configuration() == (
        "/tmp/render-gcp.json",
        "resqai-production",
    )


def test_init_vertex_rejects_missing_configuration(monkeypatch):
    monkeypatch.setattr(llm_service, "_initialized", False)
    for name in (
        "GOOGLE_APPLICATION_CREDENTIALS",
        "GOOGLE_CREDENTIAL_FILE",
        "GOOGLE_CLOUD_PROJECT",
        "PROJECT_ID",
    ):
        monkeypatch.delenv(name, raising=False)

    with pytest.raises(RuntimeError, match="Vertex AI is not configured"):
        llm_service._init_vertex()
