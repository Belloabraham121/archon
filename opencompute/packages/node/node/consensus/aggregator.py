"""Vote aggregation — verify signatures, one vote per member, 2-of-3 tally.

Every vote is signature-checked against the committee registry before it
counts. Non-members, duplicates, and tampered votes are rejected outright —
they never influence the tally.
"""

from node.common.schemas import ValidatorVote
from node.consensus.quorum import decide
from node.validator import signing


class RejectedVote(ValueError):
    pass


class Round:
    def __init__(self, job_id: str, committee: list[str], quorum: int = 2):
        self.job_id = job_id
        self.quorum = quorum
        self.registry = {vid: signing.pubkey_hex(vid) for vid in committee}
        self._by_pubkey: dict[str, ValidatorVote] = {}

    def add_vote(self, vote: ValidatorVote) -> str:
        if vote.job_id != self.job_id:
            raise RejectedVote(f"wrong job: {vote.job_id} != {self.job_id}")
        vid = next((i for i, p in self.registry.items() if p == vote.validator_pubkey), None)
        if vid is None:
            raise RejectedVote("vote from non-committee member")
        if vote.validator_pubkey in self._by_pubkey:
            raise RejectedVote("duplicate vote")
        payload = {
            "job_id": vote.job_id,
            "validator": vid,
            "vote": vote.vote,
            "evaluation_hash": vote.evaluation_hash,
        }
        if not signing.verify(vid, payload, vote.signature):
            raise RejectedVote("bad signature")
        self._by_pubkey[vote.validator_pubkey] = vote
        return self.status

    @property
    def votes(self) -> list[ValidatorVote]:
        return list(self._by_pubkey.values())

    @property
    def status(self) -> str:
        return decide([v.vote for v in self._by_pubkey.values()], self.quorum)
