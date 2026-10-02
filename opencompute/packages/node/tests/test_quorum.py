from node.consensus.quorum import decide


def test_quorum_verified():
    assert decide(["ACCEPT", "ACCEPT", "REJECT"]) == "VERIFIED"


def test_quorum_pending():
    assert decide(["ACCEPT"]) == "PENDING"
