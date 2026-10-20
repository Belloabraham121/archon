"""2-of-3 job-result consensus (PROTOCOL.md §4)."""


def decide(votes: list[str], quorum: int = 2) -> str:
    accepts = sum(1 for v in votes if v == "ACCEPT")
    rejects = sum(1 for v in votes if v == "REJECT")
    if accepts >= quorum:
        return "VERIFIED"
    if rejects >= quorum:
        return "REJECTED"
    return "PENDING"
