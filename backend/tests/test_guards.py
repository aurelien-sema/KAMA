import pytest

from app.services import religious_drift


@pytest.mark.parametrize(
    "source,output",
    [
        ("Your payment was declined. No money was taken.", "They don deny money. God no be charge money."),
        ("An unusual login was detected on your account.", "They be discover some special doctrine for ya account."),
        ("Votre paiement a été refusé.", "Dem don refuse am. Lord no go take money."),
    ],
)
def test_religious_words_absent_from_the_source_are_rejected(source, output):
    assert religious_drift(source, output)


@pytest.mark.parametrize(
    "source,output",
    [
        ("Your balance is ZZ1ZZ.", "Di money weh you get na ZZ1ZZ."),
        ("Pray for the church donation.", "Pray for di church donation."),  # la source en parle elle-meme
        ("Your faith in us matters.", "Your faith for us important."),
        ("", ""),
    ],
)
def test_normal_outputs_pass(source, output):
    assert not religious_drift(source, output)
