"""Job lifecycle state machine: CREATED→…→SETTLED (ARCHITECTURE.md §6)."""
from enum import Enum


class JobStatus(str, Enum):
    CREATED = "CREATED"
    AVAILABLE = "AVAILABLE"
    CLAIMED = "CLAIMED"
    RUNNING = "RUNNING"
    SUBMITTED = "SUBMITTED"
    VALIDATING = "VALIDATING"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"
    SETTLED = "SETTLED"
