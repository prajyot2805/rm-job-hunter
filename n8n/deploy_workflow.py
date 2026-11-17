#!/usr/bin/env python3
"""
n8n/deploy_workflow.py - Automated Deployment & Verification of the
Corporate Banking RM Job Hunter n8n workflow.

Zero pip dependencies: uses pure Python standard library only
(os, sys, json, urllib.request, urllib.error, urllib.parse, argparse).
"""

import os
import sys
import json
import argparse
import urllib.request
import urllib.error
import urllib.parse
from typing import Dict, Any, Optional, Tuple, List

DEFAULT_WORKFLOW_NAME = "Corporate Banking RM Job Hunter"
DEFAULT_WEBHOOK_PATH = "fetch-jobs"


def find_project_root() -> str:
    """Resolve absolute path to project root."""
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def parse_env_file(env_path: str) -> Dict[str, str]:
    """
    Safely parse .env file without external dependencies or shell execution.
    Normalizes N8N_URL by stripping trailing slashes.
    """
    if not os.path.isfile(env_path):
        raise FileNotFoundError(f".env file not found at: {env_path}")

    config = {}
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip().strip("\"'")
            config[key] = val

    n8n_url = config.get("N8N_URL", "").rstrip("/")
    api_key = config.get("N8N_API_KEY", "")

    if not n8n_url:
        raise ValueError(f"N8N_URL missing in {env_path}")
    if not api_key or api_key == "your_api_key_here":
        raise ValueError(f"N8N_API_KEY missing or unconfigured placeholder in {env_path}")

    config["N8N_URL"] = n8n_url
    return config


def sanitize_workflow_payload(raw_wf: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sanitize workflow JSON to comply with n8n Public API's strict
    'additionalProperties: false' requirement.
    Only allows: name, nodes, connections, settings, staticData.
    """
    allowed_keys = {"name", "nodes", "connections", "settings", "staticData"}
    sanitized = {k: raw_wf[k] for k in allowed_keys if k in raw_wf}

    if "settings" not in sanitized or not isinstance(sanitized["settings"], dict):
        sanitized["settings"] = {"executionOrder": "v1"}
    elif "executionOrder" not in sanitized["settings"]:
        sanitized["settings"]["executionOrder"] = "v1"

    return sanitized


def extract_webhook_path(wf: Dict[str, Any], default_path: str = DEFAULT_WEBHOOK_PATH) -> str:
    """Extract webhook path from the Webhook node if present."""
    for node in wf.get("nodes", []):
        if node.get("type") == "n8n-nodes-base.webhook":
            return node.get("parameters", {}).get("path", default_path)
    return default_path


class N8nDeployer:
    """Manages REST API interactions with the self-hosted n8n instance."""

    def __init__(self, n8n_url: str, api_key: str):
        self.url = n8n_url.rstrip("/")
        self.api_key = api_key

    def _api_request(
        self, endpoint: str, method: str = "GET", data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        url = f"{self.url}{endpoint}"
        body = json.dumps(data).encode("utf-8") if data is not None else None
        headers = {
            "X-N8N-API-KEY": self.api_key,
            "Accept": "application/json",
            "User-Agent": "CorporateBankingRMJobHunter/1.0",
        }
        if data is not None:
            headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
                resp_text = resp.read().decode("utf-8")
                return json.loads(resp_text) if resp_text else {}
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8") if e.fp else ""
            raise RuntimeError(f"n8n API {method} {endpoint} failed (HTTP {e.code}): {err_body}")
        except urllib.error.URLError as e:
            raise ConnectionError(f"Could not connect to n8n at {self.url}: {e.reason}")

    def check_health(self) -> bool:
        """Check /healthz endpoint on n8n server."""
        url = f"{self.url}/healthz"
        req = urllib.request.Request(url, headers={"User-Agent": "JobHunterDeployer/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data.get("status") == "ok"
        except Exception as e:
            print(f"[!] Health check failed at {url}: {e}")
            return False

    def list_workflows(self) -> List[Dict[str, Any]]:
        """List all workflows from n8n."""
        res = self._api_request("/api/v1/workflows")
        return res.get("data", [])

    def find_workflow_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Find existing workflow matching the specified name."""
        workflows = self.list_workflows()
        for wf in workflows:
            if wf.get("name", "").strip().lower() == name.strip().lower():
                return wf
        return None

    def create_workflow(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Create new workflow via POST /api/v1/workflows."""
        sanitized = sanitize_workflow_payload(payload)
        return self._api_request("/api/v1/workflows", method="POST", data=sanitized)

    def update_workflow(self, wf_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Update existing workflow via PUT /api/v1/workflows/{id}."""
        sanitized = sanitize_workflow_payload(payload)
        return self._api_request(f"/api/v1/workflows/{wf_id}", method="PUT", data=sanitized)

    def activate_workflow(self, wf_id: str) -> Dict[str, Any]:
        """Activate workflow via POST /api/v1/workflows/{id}/activate."""
        return self._api_request(f"/api/v1/workflows/{wf_id}/activate", method="POST")

    def test_webhook(
        self, path: str, params: Optional[Dict[str, str]] = None
    ) -> Tuple[int, Dict[str, Any], Dict[str, str]]:
        """Trigger public webhook and return status, json body, and response headers."""
        if params is None:
            params = {"location": "Mumbai", "segment": "Large Corporate"}
        query_str = urllib.parse.urlencode(params)
        url = f"{self.url}/webhook/{path}?{query_str}"
        req = urllib.request.Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                headers = {k.lower(): v for k, v in dict(resp.headers).items()}
                body = json.loads(resp.read().decode("utf-8"))
                return resp.status, body, headers
        except urllib.error.HTTPError as e:
            headers = {k.lower(): v for k, v in dict(e.headers).items()}
            body = json.loads(e.read().decode("utf-8")) if e.fp else {}
            return e.code, body, headers
        except Exception as e:
            raise RuntimeError(f"Webhook test request to {url} failed: {e}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Deploy and verify Corporate Banking RM Job Hunter workflow on self-hosted n8n."
    )
    parser.add_argument(
        "--env-file",
        default=os.path.join(find_project_root(), ".env"),
        help="Path to .env configuration file",
    )
    parser.add_argument(
        "--workflow-file",
        default=os.path.join(find_project_root(), "n8n", "rm_job_hunter_workflow.json"),
        help="Path to rm_job_hunter_workflow.json",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate configuration and connectivity without modifying n8n state",
    )
    parser.add_argument(
        "--test-only",
        action="store_true",
        help="Skip deployment and test the live webhook directly",
    )
    parser.add_argument(
        "--force-create",
        action="store_true",
        help="Force creation of a new workflow even if an existing one is found",
    )

    args = parser.parse_args()

    print("=" * 70)
    print("Corporate Banking RM Job Hunter — n8n Workflow Deployer")
    print("=" * 70)

    # 1. Parse .env
    try:
        env = parse_env_file(args.env_file)
        n8n_url = env["N8N_URL"]
        api_key = env["N8N_API_KEY"]
        masked_key = f"{api_key[:8]}...{api_key[-6:]}" if len(api_key) > 14 else "***"
        print(f"[+] Loaded config from: {args.env_file}")
        print(f"    n8n URL: {n8n_url}")
        print(f"    API Key: {masked_key}")
    except Exception as e:
        print(f"[-] Config error: {e}")
        return 1

    deployer = N8nDeployer(n8n_url, api_key)

    # 2. Check n8n health
    print(f"[+] Checking n8n health at {n8n_url}/healthz ...")
    if not deployer.check_health():
        print(f"[-] Health check failed for {n8n_url}")
        return 2
    print("    ✓ n8n server is healthy (status: ok)")

    # 3. Load workflow JSON
    if not os.path.isfile(args.workflow_file):
        print(f"[-] Workflow file not found at: {args.workflow_file}")
        return 1

    try:
        with open(args.workflow_file, "r", encoding="utf-8") as f:
            wf_data = json.load(f)
        wf_name = wf_data.get("name", DEFAULT_WORKFLOW_NAME)
        webhook_path = extract_webhook_path(wf_data, DEFAULT_WEBHOOK_PATH)
        print(f"[+] Loaded workflow: '{wf_name}' ({len(wf_data.get('nodes', []))} nodes)")
        print(f"    Webhook path: /webhook/{webhook_path}")
    except Exception as e:
        print(f"[-] Failed to load workflow JSON: {e}")
        return 1

    # If --test-only
    if args.test_only:
        print(f"[+] Running in test-only mode. Querying /webhook/{webhook_path} ...")
        return verify_live_webhook(deployer, webhook_path)

    # Check for existing workflow
    print(f"[+] Checking for existing workflow named '{wf_name}' ...")
    try:
        existing_wf = deployer.find_workflow_by_name(wf_name)
    except Exception as e:
        print(f"[-] Failed to query workflows: {e}")
        return 2

    if existing_wf:
        wf_id = existing_wf["id"]
        is_active = existing_wf.get("active", False)
        print(f"    Found existing workflow: ID = {wf_id} (active: {is_active})")
    else:
        wf_id = None
        print("    No existing workflow found with that name.")

    # If --dry-run
    if args.dry_run:
        print("\n[+] DRY-RUN SUCCESSFUL")
        action = "CREATE fresh workflow" if not wf_id or args.force_create else f"UPDATE workflow {wf_id}"
        print(f"    Action that would be executed: {action}")
        print("    No changes made to n8n server.")
        return 0

    # 4. Create or Update Workflow
    target_id = wf_id
    try:
        if not wf_id or args.force_create:
            print(f"[+] Creating new workflow '{wf_name}' ...")
            created = deployer.create_workflow(wf_data)
            target_id = created["id"]
            print(f"    ✓ Workflow created with ID: {target_id}")
        else:
            print(f"[+] Updating existing workflow ID: {target_id} ...")
            deployer.update_workflow(target_id, wf_data)
            print(f"    ✓ Workflow {target_id} updated successfully")
    except Exception as e:
        print(f"[-] Workflow deployment failed: {e}")
        return 2

    # 5. Activate Workflow
    print(f"[+] Activating workflow ID: {target_id} ...")
    try:
        act_res = deployer.activate_workflow(target_id)
        active_status = act_res.get("active", False)
        print(f"    ✓ Workflow active status: {active_status}")
    except Exception as e:
        print(f"[-] Workflow activation failed: {e}")
        return 2

    # 6. Verify Live Webhook Execution
    print(f"[+] Verifying live webhook endpoint: /webhook/{webhook_path} ...")
    return verify_live_webhook(deployer, webhook_path)


def verify_live_webhook(deployer: N8nDeployer, webhook_path: str) -> int:
    """Trigger webhook and verify response status, CORS, and job schema."""
    try:
        status, body, headers = deployer.test_webhook(
            webhook_path, {"location": "Mumbai", "segment": "Large Corporate"}
        )
    except Exception as e:
        print(f"[-] Webhook call failed: {e}")
        return 3

    print(f"    Response HTTP Status: {status}")
    cors_origin = headers.get("access-control-allow-origin", "")
    print(f"    CORS Header (access-control-allow-origin): {cors_origin}")

    if status != 200:
        print(f"[-] Webhook returned non-200 status code: {status}")
        print(f"    Response body: {json.dumps(body, indent=2)[:500]}")
        return 3

    if cors_origin != "*":
        print(f"[!] Warning: Access-Control-Allow-Origin header is '{cors_origin}' (expected '*')")

    if not isinstance(body, dict) or body.get("status") != "success":
        print("[-] Invalid response structure: expected {'status': 'success', ...}")
        print(f"    Received: {json.dumps(body, indent=2)[:500]}")
        return 3

    jobs = body.get("jobs", [])
    if not isinstance(jobs, list) or len(jobs) == 0:
        print("[-] No jobs returned in response")
        return 3

    print(f"    ✓ Webhook delivered {len(jobs)} corporate banking opportunities!")
    print(f"    Fallback applied: {body.get('fallback_applied', False)}")

    # Spot check first job
    first_job = jobs[0]
    print(f"    Sample Job: [{first_job.get('segment')}] {first_job.get('title')} at {first_job.get('organization')}")
    print(f"    Location: {first_job.get('location')} | Apply Email: {first_job.get('applyEmail')}")

    print("\n" + "=" * 70)
    print("DEPLOYMENT AND WEBHOOK VERIFICATION SUCCESSFUL (Exit Code 0)")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    sys.exit(main())
