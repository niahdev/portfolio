const encodedContact = "d3cxMTAwNDdAbmF2ZXIuY29t";

function revealContact() {
  const email = atob(encodedContact);
  const label = document.querySelector("#contact-email");
  if (label) label.textContent = email;

  document.querySelectorAll(".email-reveal").forEach((button) => {
    const link = document.createElement("a");
    link.href = `mailto:${email}`;
    link.textContent = "이메일 보내기 ↗";
    button.replaceWith(link);
  });
}

document.querySelectorAll(".email-reveal").forEach((button) => {
  button.addEventListener("click", revealContact, { once: true });
});
