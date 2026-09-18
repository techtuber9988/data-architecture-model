/* ============================================================
   DOCUMENT MODEL — INTERACTION ENGINE
   ============================================================ */


/* ============================================================
   DOM READY
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

  initParticles();

  initCursorGlow();

  initScrollReveal();

  initScrollProgress();

  initHeader();

  initActiveNavigation();

  initTiltCards();

  initGlowCards();

  initMagneticButtons();

  initSchemaInteractions();

  initBackToTop();

  initSmoothAnchors();

});


/* ============================================================
   PARTICLE FIELD
   ============================================================ */

function initParticles() {

  const field =
    document.querySelector(".particle-field");

  if (!field) return;


  const particleCount =
    window.innerWidth < 700 ? 18 : 34;


  for (let i = 0; i < particleCount; i++) {

    const particle =
      document.createElement("span");

    particle.className =
      "particle";


    particle.style.left =
      `${Math.random() * 100}%`;


    particle.style.top =
      `${60 + Math.random() * 50}%`;


    particle.style.animationDuration =
      `${8 + Math.random() * 15}s`;


    particle.style.animationDelay =
      `${Math.random() * -15}s`;


    particle.style.opacity =
      `${0.08 + Math.random() * 0.28}`;


    field.appendChild(particle);
  }

}


/* ============================================================
   CURSOR GLOW
   ============================================================ */

function initCursorGlow() {

  const glow =
    document.querySelector(".cursor-glow");

  if (!glow) return;


  if (
    window.matchMedia("(pointer: coarse)").matches
  ) {
    return;
  }


  let mouseX = 0;
  let mouseY = 0;

  let currentX = 0;
  let currentY = 0;


  window.addEventListener("mousemove", (event) => {

    mouseX = event.clientX;
    mouseY = event.clientY;

    glow.style.opacity = "1";

  });


  function animate() {

    currentX +=
      (mouseX - currentX) * 0.10;

    currentY +=
      (mouseY - currentY) * 0.10;


    glow.style.left =
      `${currentX}px`;

    glow.style.top =
      `${currentY}px`;


    requestAnimationFrame(animate);
  }


  animate();

}


/* ============================================================
   SCROLL REVEAL
   ============================================================ */

function initScrollReveal() {

  const elements =
    document.querySelectorAll(".reveal");


  if (!elements.length) return;


  const observer =
    new IntersectionObserver(
      (entries) => {

        entries.forEach((entry) => {

          if (entry.isIntersecting) {

            entry.target.classList.add(
              "visible"
            );

            observer.unobserve(
              entry.target
            );
          }

        });

      },
      {
        threshold: 0.12
      }
    );


  elements.forEach((element) => {

    observer.observe(element);

  });

}


/* ============================================================
   SCROLL PROGRESS
   ============================================================ */

function initScrollProgress() {

  const progress =
    document.querySelector(".scroll-progress");

  if (!progress) return;


  function update() {

    const scrollTop =
      window.scrollY;

    const scrollHeight =
      document.documentElement.scrollHeight
      - window.innerHeight;


    const percentage =
      scrollHeight > 0
        ? (scrollTop / scrollHeight) * 100
        : 0;


    progress.style.width =
      `${percentage}%`;

  }


  window.addEventListener(
    "scroll",
    update,
    { passive: true }
  );


  update();

}


/* ============================================================
   HEADER EFFECT
   ============================================================ */

function initHeader() {

  const header =
    document.querySelector(".site-header");

  if (!header) return;


  function update() {

    header.classList.toggle(
      "scrolled",
      window.scrollY > 30
    );

  }


  window.addEventListener(
    "scroll",
    update,
    { passive: true }
  );


  update();

}


/* ============================================================
   ACTIVE NAVIGATION
   ============================================================ */

function initActiveNavigation() {

  const links =
    document.querySelectorAll(
      ".nav-link"
    );


  const sections =
    document.querySelectorAll(
      "main section[id]"
    );


  if (!links.length || !sections.length) {
    return;
  }


  const observer =
    new IntersectionObserver(
      (entries) => {

        entries.forEach((entry) => {

          if (!entry.isIntersecting) {
            return;
          }


          links.forEach((link) => {

            link.classList.remove(
              "active"
            );

          });


          const active =
            document.querySelector(
              `.nav-link[href="#${entry.target.id}"]`
            );


          if (active) {

            active.classList.add(
              "active"
            );

          }

        });

      },
      {
        rootMargin:
          "-25% 0px -60% 0px"
      }
    );


  sections.forEach((section) => {

    observer.observe(section);

  });

}


/* ============================================================
   TILT CARD
   ============================================================ */

function initTiltCards() {

  const cards =
    document.querySelectorAll(
      "[data-tilt]"
    );


  if (
    !cards.length ||
    window.matchMedia("(pointer: coarse)").matches
  ) {
    return;
  }


  cards.forEach((card) => {

    card.addEventListener(
      "mousemove",
      (event) => {

        const rect =
          card.getBoundingClientRect();


        const x =
          event.clientX - rect.left;


        const y =
          event.clientY - rect.top;


        const rotateY =
          ((x / rect.width) - 0.5) * 8;


        const rotateX =
          ((y / rect.height) - 0.5) * -8;


        card.style.animation =
          "none";


        card.style.transform =
          `perspective(900px)
           rotateX(${rotateX}deg)
           rotateY(${rotateY}deg)
           translateY(-5px)`;


        const shine =
          card.querySelector(".card-shine");


        if (shine) {

          shine.style.left =
            `${x}px`;

          shine.style.top =
            `${y}px`;

        }

      }
    );


    card.addEventListener(
      "mouseleave",
      () => {

        card.style.transform = "";

        card.style.animation =
          "";

      }
    );

  });

}


/* ============================================================
   CARD CURSOR GLOW
   ============================================================ */

function initGlowCards() {

  const cards =
    document.querySelectorAll(
      ".glow-card"
    );


  if (
    window.matchMedia("(pointer: coarse)").matches
  ) {
    return;
  }


  cards.forEach((card) => {

    card.addEventListener(
      "mousemove",
      (event) => {

        const rect =
          card.getBoundingClientRect();


        const x =
          event.clientX - rect.left;


        const y =
          event.clientY - rect.top;


        card.style.setProperty(
          "--glow-x",
          `${x}px`
        );


        card.style.setProperty(
          "--glow-y",
          `${y}px`
        );

      }
    );

  });

}


/* ============================================================
   MAGNETIC BUTTONS
   ============================================================ */

function initMagneticButtons() {

  const elements =
    document.querySelectorAll(
      ".magnetic"
    );


  if (
    window.matchMedia("(pointer: coarse)").matches
  ) {
    return;
  }


  elements.forEach((element) => {

    element.addEventListener(
      "mousemove",
      (event) => {

        const rect =
          element.getBoundingClientRect();


        const x =
          event.clientX
          - rect.left
          - rect.width / 2;


        const y =
          event.clientY
          - rect.top
          - rect.height / 2;


        element.style.transform =
          `translate(
            ${x * 0.10}px,
            ${y * 0.10}px
          )`;

      }
    );


    element.addEventListener(
      "mouseleave",
      () => {

        element.style.transform =
          "";

      }
    );

  });

}


/* ============================================================
   SCHEMA INTERACTION
   ============================================================ */

function initSchemaInteractions() {

  const nodes =
    document.querySelectorAll(
      ".schema-node-interactive"
    );


  const mapPills =
    document.querySelectorAll(
      ".map-pill"
    );


  nodes.forEach((node) => {

    node.addEventListener(
      "mouseenter",
      () => {

        const table =
          node.dataset.table;


        if (!table) return;


        mapPills.forEach((pill) => {

          const label =
            pill.querySelector("b");


          if (!label) return;


          const matches =
            label.textContent
              .trim()
              .toLowerCase()
              .includes(
                table
                  .split("_")[0]
                  .toLowerCase()
              );


          if (matches) {

            pill.style.borderColor =
              "rgba(141,243,206,0.55)";

            pill.style.boxShadow =
              "0 0 25px rgba(54,215,170,0.12)";

          }

        });

      }
    );


    node.addEventListener(
      "mouseleave",
      () => {

        mapPills.forEach((pill) => {

          pill.style.borderColor = "";

          pill.style.boxShadow = "";

        });

      }
    );

  });

}


/* ============================================================
   BACK TO TOP
   ============================================================ */

function initBackToTop() {

  const button =
    document.querySelector(
      ".back-top"
    );


  if (!button) return;


  window.addEventListener(
    "scroll",
    () => {

      button.classList.toggle(
        "visible",
        window.scrollY > 600
      );

    },
    { passive: true }
  );


  button.addEventListener(
    "click",
    () => {

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });

    }
  );

}


/* ============================================================
   SMOOTH INTERNAL LINKS
   ============================================================ */

function initSmoothAnchors() {

  document
    .querySelectorAll(
      'a[href^="#"]'
    )
    .forEach((link) => {

      link.addEventListener(
        "click",
        (event) => {

          const selector =
            link.getAttribute("href");


          if (
            !selector ||
            selector === "#"
          ) {
            return;
          }


          const target =
            document.querySelector(
              selector
            );


          if (!target) return;


          event.preventDefault();


          target.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });

        }
      );

    });

}
