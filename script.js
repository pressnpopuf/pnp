

    /* =====================================================
       BESTÄLLNING VIA E-POST
    ===================================================== */

    const ORDER_EMAIL = "pressnpop.uf@gmail.com";

    function escapeEmailText(value) {
        return String(value ?? "")
            .replace(/\r?\n/g, " ")
            .trim();
    }

    function toggleDeliveryAddress() {
        const fields = document.getElementById("cartShippingFields");
        if (fields) fields.style.display = selectedDelivery === "shipping" ? "block" : "none";
    }

    function formatCartItemForEmail(item, index) {
        const lines = [];
        lines.push(`${index}. ${escapeEmailText(item.name)}`);
        lines.push(`   Antal: ${Number(item.quantity) || 1}`);
        if (item.color) lines.push(`   Färg: ${escapeEmailText(item.color)}`);
        if (item.length) lines.push(`   Längd: ${escapeEmailText(item.length)}`);

        const sizes = item.sizes || {};
        const labels = { thumb:"Tumme/Stortå", index:"Pekfinger/Tå 2", middle:"Långfinger/Tå 3", ring:"Ringfinger/Tå 4", pinky:"Lillfinger/Lilltå", toe:"Tå" };
        const sizeLines = Object.entries(sizes)
            .filter(([, value]) => value !== undefined && value !== null && String(value) !== "")
            .map(([key, value]) => `      ${labels[key] || key}: ${escapeEmailText(value)}`);
        if (sizeLines.length) {
            lines.push("   Storlekar:");
            lines.push(...sizeLines);
        }

        const options = item.options || {};
        if (options.form) lines.push(`   Form: ${escapeEmailText(options.form)}`);
        if (options.finger) lines.push(`   Finger: ${escapeEmailText(options.finger)}`);
        if (options.finger && options.size !== undefined && options.size !== "") lines.push(`   Storlek: ${escapeEmailText(options.size)}${options.sizeMm ? " (" + escapeEmailText(options.sizeMm) + ")" : ""}`);
        if (options.changes) lines.push(`   ${"Ändringar"}: ${escapeEmailText(options.changes)}`);
        if (options.note) lines.push(`   Info: ${escapeEmailText(options.note)}`);
        if (options.inspoData && options.inspoFile) {
            lines.push(`   Inspo-bild (bilaga): ${getInspoAttachmentName(item, index)}`);
            lines.push("   Bilden ovan hör till önskemålen för just denna produktrad.");
        } else if (options.inspoFile) {
            lines.push(`   Inspo-bild: ${escapeEmailText(options.inspoFile)} (ingen bilddata kunde bifogas)`);
        }
        return lines.join("\n");
    }

    function checkoutCart() {
        cart = cart.filter(item => item && item.name && Number(item.quantity) > 0);
        saveCart();

        if (!cart.length) {
            alert("Din varukorg är tom ");
            return;
        }

        [
            "cartCheckoutFirstName", "cartCheckoutLastName", "cartCheckoutPhone",
            "cartCheckoutEmail", "cartCheckoutAddress", "cartCheckoutPostal",
            "cartCheckoutCity", "cartCheckoutMessage"
        ].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = "";
        });

        toggleDeliveryAddress();
        document.getElementById("cartCheckoutModal").classList.add("active");
    }

     function buildOrderEmailBody(firstName, lastName, phone, email, delivery, address, message) {
         const lines = [
             "NY BESTÄLLNING – PressN’Pop UF",
             "",
             `Kund: ${firstName} ${lastName}`,
             `Telefon: ${phone}`,
             `E-post: ${email}`,
             `Leverans: ${delivery === "shipping" ? "Frakt" : "Hämta upp"}`,
             delivery === "shipping" ? `Adress: ${address}` : "",
             message ? `Meddelande: ${message}` : "",
             "",
             "PRODUKTER:"
         ];

         cart.forEach((item, index) => {
             lines.push(formatCartItemForEmail(item, index + 1));
             lines.push(`   Pris/st: ${getCartItemUnitPrice(item)} kr`);
         });

         lines.push("");
         lines.push(`Varor: ${getCartSubtotal()} kr`);
         lines.push(`Frakt: ${getShippingFee()} kr`);
         lines.push(`Totalt: ${getCartSubtotal() + getShippingFee()} kr`);
         lines.push("");
         lines.push(`Betalning: kunden ska swisha ${getCartSubtotal() + getShippingFee()} kr till 123 705 24 59.`);
         lines.push(`Matcha betalningen mot namn (${firstName} ${lastName}) och telefonnummer (${phone}).`);
         if (cart.some(item => item?.options?.inspoData)) {
             lines.push("");
             lines.push("Kundens inspo-bilder är bifogade i detta mejl.");
         }

         return lines.filter(Boolean).join("\r\n");
     }

     function encodeBase64Utf8(text) {
         const bytes = new TextEncoder().encode(text);
         let binary = "";
         for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
         return btoa(binary);
     }

     function encodeBase64Bytes(bytes) {
         let binary = "";
         const chunkSize = 0x8000;
         for (let i = 0; i < bytes.length; i += chunkSize) {
             binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
         }
         return btoa(binary);
     }

     function wrapBase64(value) {
         return value.match(/.{1,76}/g)?.join("\r\n") || "";
     }

     function safeAttachmentName(name) {
         return String(name || "inspo-bild.jpg")
             .replace(/[^\w.\-]/g, "_")
             .slice(0, 100);
     }

     // Bilagenamnet innehåller samma radnummer som i ordermejlet så att
     // varje inspobild säkert kan kopplas till rätt önskemål.
     function getInspoAttachmentName(item, index, mimeType) {
         const rawName = safeAttachmentName(item?.options?.inspoFile || "inspo-bild.jpg");
         const data = item?.options?.inspoData || "";
         const detectedMime = mimeType || (data.match(/^data:([^;,]+)?;base64,/) || [])[1] || "";
         const isJpeg = detectedMime === "image/jpeg";
         const originalName = isJpeg
             ? rawName.replace(/\.[^.]+$/, "") + ".jpg"
             : rawName;
         const rowNumber = String(index).padStart(2, "0");
         const productName = safeAttachmentName(item?.name || "Custom");
         return `${rowNumber}-${productName}-${originalName}`.slice(0, 180);
     }

     async function createOrderEmailFile(to, subject, body, attachments) {
         const boundary = "PressNPop_" + Date.now().toString(36) + "_boundary";
         const lines = [
             `To: ${to}`,
             `Subject: =?UTF-8?B?${encodeBase64Utf8(subject)}?=`,
             "MIME-Version: 1.0",
             `Content-Type: multipart/mixed; boundary="${boundary}"`,
             "",
             `--${boundary}`,
             'Content-Type: text/plain; charset="UTF-8"',
             "Content-Transfer-Encoding: base64",
             "",
             wrapBase64(encodeBase64Utf8(body))
         ];

         for (const attachment of attachments) {
             lines.push(
                 `--${boundary}`,
                 `Content-Type: ${attachment.mimeType || "application/octet-stream"}; name="${attachment.name}"`,
                 "Content-Transfer-Encoding: base64",
                 `Content-Disposition: attachment; filename="${attachment.name}"`,
                 "",
                 wrapBase64(attachment.base64)
             );
         }

         lines.push(`--${boundary}--`, "");
         const emlBlob = new Blob([lines.join("\r\n")], { type: "message/rfc822" });
         const url = URL.createObjectURL(emlBlob);
         const link = document.createElement("a");
         link.href = url;
         link.download = "PressNPop-bestallning.eml";
         document.body.appendChild(link);
         link.click();
         link.remove();
         setTimeout(() => URL.revokeObjectURL(url), 60000);
     }

     function postOrderViaHiddenForm(fields, files) {
         // Ett separat formulär/iframe per bild. srcdoc ger en tydlig startsida
         // även i mobila Safari, där about:blank ibland redan hunnit laddas
         // innan load-lyssnaren kopplas på.
         return new Promise(resolve => {
             if (!Array.isArray(files) || files.length !== 1) {
                 resolve({ ok: false, message: "Varje mejl måste innehålla exakt en inspo-bild." });
                 return;
             }

             const token = Date.now().toString(36) + Math.random().toString(36).slice(2);
             const frameName = "orderSendFrame_" + token;
             const iframe = document.createElement("iframe");
             iframe.name = frameName;
             iframe.srcdoc = "<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>";
             iframe.style.display = "none";

             const form = document.createElement("form");
             form.method = "POST";
             form.action = "https://formsubmit.co/pressnpop.uf@gmail.com";
             form.enctype = "multipart/form-data";
             form.target = frameName;
             form.style.display = "none";

             fields.forEach(([name, value]) => {
                 const field = document.createElement("textarea");
                 field.name = name;
                 field.value = String(value);
                 form.appendChild(field);
             });

             try {
                 const file = files[0];
                 const input = document.createElement("input");
                 input.type = "file";
                 input.name = "attachment";
                 input.accept = "image/*";
                 const binary = atob(file.base64);
                 const bytes = new Uint8Array(binary.length);
                 for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                 const transfer = new DataTransfer();
                 transfer.items.add(new File([bytes], file.name, { type: file.mimeType || "application/octet-stream" }));
                 input.files = transfer.files;
                 if (!input.files || input.files.length !== 1) {
                     throw new Error("Webbläsaren kunde inte bifoga bilden. Prova en annan webbläsare eller en mindre JPG-bild.");
                 }
                 form.appendChild(input);
             } catch (error) {
                 console.warn("Kunde inte lägga till inspo-bilagan:", error);
                 iframe.remove();
                 form.remove();
                 resolve({ ok: false, message: error.message || "Bilagan kunde inte läggas till" });
                 return;
             }

             let finished = false;
             let responseListener = null;
             let timer = null;
             const cleanup = () => {
                 if (timer) clearTimeout(timer);
                 if (responseListener) iframe.removeEventListener("load", responseListener);
                 setTimeout(() => { iframe.remove(); form.remove(); }, 500);
             };
             const finish = (ok, message) => {
                 if (finished) return;
                 finished = true;
                 cleanup();
                 resolve({ ok, message });
             };

             // Starta timeouten direkt så att kunden aldrig fastnar för evigt
             // om en mobil webbläsare inte skickar iframe:ens första load-event.
             timer = setTimeout(
                 () => finish(false, "Mobilens webbläsare fick inget svar från FormSubmit inom 30 sekunder."),
                 30000
             );

             const onInitialLoad = () => {
                 if (finished) return;
                 responseListener = () => finish(true, "");
                 iframe.addEventListener("load", responseListener, { once: true });
                 try {
                     form.submit();
                 } catch (error) {
                     finish(false, error.message || "Beställningen kunde inte skickas från webbläsaren.");
                 }
             };

             iframe.addEventListener("load", onInitialLoad, { once: true });
             document.body.appendChild(iframe);
             document.body.appendChild(form);
         });
     }
     // Skickar beställningen som mejl via FormSubmit (ingen egen server behövs).
     async function postOrderToFormSubmit(subject, body, customerName, customerEmail, files) {
         const formData = new FormData();
         formData.append("_subject", subject);
         formData.append("_template", "table");
         formData.append("_captcha", "false");
         formData.append("name", customerName);
         formData.append("email", customerEmail);
         formData.append("Bestallning", body);

         // Automatisk bekräftelse till kunden (skickas till e-postadressen kunden angav).
         const orderTotal = getCartSubtotal() + getShippingFee();
         formData.append("_autoresponse",
             "Hej " + customerName + "!\n\n" +
             "Tack för din beställning hos PressN’Pop UF! \n\n" +
             "Nästa steg är att swisha " + orderTotal.toLocaleString("sv-SE") + " kr till 123 705 24 59.\n" +
             "Swisha exakt den summan, och använd samma telefonnummer som du angav i beställningen så att vi kan matcha din betalning.\n\n" +
             "När vi har fått din betalning börjar vi göra dina naglar. Vi återkommer med information om leverans eller upphämtning.\n\n" +
             "Har du frågor? Svara på det här mejlet eller kontakta oss på pressnpop.uf@gmail.com.\n\n" +
             "Kram,\nPressN’Pop UF"
         );

         // Bilagor stöds inte av FormSubmits AJAX-läge. Med bilder skickas därför ett vanligt
         // formulär (multipart) via en dold ram, vilket är det sätt FormSubmit stöder bilagor på.
         if (files.length) {
             return postOrderViaHiddenForm(Array.from(formData.entries()), files);
         }

         const response = await fetch("https://formsubmit.co/ajax/pressnpop.uf@gmail.com", {
             method: "POST",
             headers: { "Accept": "application/json" },
             body: formData
         });
         const result = await response.json().catch(() => ({}));
         const ok = response.ok && (result.success === true || result.success === "true");
         if (!ok) console.warn("FormSubmit svarade:", response.status, result);
         return { ok, message: result.message || ("HTTP " + response.status) };
     }

     async function sendOrderAutomatically(subject, body, customerName, customerEmail, files, onProgress) {
         // En enda checkout-körning skickar samtliga bilder i ordning.
         // Låset skyddar mot att två parallella körningar startas.
         if (window.pressNPopSendingImages) {
             window.lastOrderSendError = "Beställningen håller redan på att skickas.";
             return false;
         }
         window.pressNPopSendingImages = true;
         try {
         // Skicka inte en order tyst utan inspo-bilderna som kunden valt.
         const totalBytes = files.reduce((sum, file) => sum + Math.floor((file.base64.length * 3) / 4), 0);
         if (totalBytes > 9 * 1024 * 1024) {
             window.lastOrderSendError = "Inspo-bilderna är tillsammans för stora för FormSubmit (max 10 MB).";
             return false;
         }

         // Ett fristående FormSubmit-anrop per uppladdad bild.
         // En bild ger ett mejl; två bilder ger två mejl, även om kunden
         // har flera andra produkter i varukorgen.
         if (files.length > 0) {
             for (let index = 0; index < files.length; index++) {
                 if (typeof onProgress === "function") onProgress(index + 1, files.length);
                 const file = files[index];
                 const mailSubject = files.length > 1
                     ? `${subject} – Inspo ${index + 1} av ${files.length}`
                     : subject;
                 const mailBody = body + "\n\n" +
                     `Bifogad inspirationsbild: ${file.name}\n` +
                     (files.length > 1
                         ? `Detta är mejl ${index + 1} av ${files.length}; det innehåller endast denna bild.\n`
                         : "Detta mejl innehåller beställningens inspirationsbild.\n");
                 const result = await postOrderToFormSubmit(
                     mailSubject, mailBody, customerName, customerEmail, [file]
                 );
                 if (!result.ok) {
                     window.lastOrderSendError = `Mejl ${index + 1} av ${files.length}: ` +
                         (result.message || "kunde inte skickas");
                     return false;
                 }
                 // Kort paus mellan separata inskick för att inte skicka dem samtidigt.
                 if (index < files.length - 1) {
                     await new Promise(resolve => setTimeout(resolve, 1200));
                 }
             }
             window.lastOrderSendError = "";
             return true;
         }

         const result = await postOrderToFormSubmit(subject, body, customerName, customerEmail, files);
         window.lastOrderSendError = result.ok ? "" : result.message;
         return result.ok;
         } finally {
             window.pressNPopSendingImages = false;
         }
     }

     const SWISH_BUSINESS_NUMBER = "1237052459";

     function openSwishPayment() {
         const total = getCartSubtotal() + getShippingFee();
         const panel = document.getElementById("swishPaymentPanel");
         const amount = document.getElementById("swishCheckoutAmount");
         const qr = document.getElementById("swishCheckoutQr");
         if (!panel || !amount || !qr) return;

         amount.textContent = `${total.toLocaleString("sv-SE")} kr`;
         const paymentData = {
             version: 1,
             payee: { value: SWISH_BUSINESS_NUMBER },
             amount: { value: Number(total.toFixed(2)) },
             message: { value: "PressNPop bestallning" }
         };
         const swishUrl = "swish://payment?data=" + encodeURIComponent(JSON.stringify(paymentData));
         qr.src = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=" + encodeURIComponent(swishUrl);
         panel.hidden = false;

         // Öppnar Swish på telefoner som stöder Swish deep links.
         if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
             window.location.href = swishUrl;
         } else {
             panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
         }
     }

     async function copySwishDetails() {
         try {
             await navigator.clipboard.writeText(SWISH_BUSINESS_NUMBER);
             alert("Swish-numret har kopierats.");
         } catch (error) {
             alert("Swish Företag: 123 705 2459");
         }
     }

     function inquireExtraService(service, options = "") {
         const subject = encodeURIComponent(`Fråga om ${service} – PressN’Pop`);
         const body = encodeURIComponent(
             `Hej PressN’Pop!\n\nJag är intresserad av: ${service}\n${options ? "Val: " + options + "\n" : ""}\nKan ni återkomma med pris och hur jag beställer?\n\nNamn:\nTelefon:`
         );
         window.location.href = `mailto:pressnpop.uf@gmail.com?subject=${subject}&body=${body}`;
     }

     async function finalizeCartCheckout() {
         if (cart.some(item => !item || !item.name || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 99)) {
             alert("Kontrollera antal i varukorgen. Antalet måste vara ett heltal mellan 1 och 99.");
             return;
         }
         saveCart();

         if (!cart.length) {
             alert("Din varukorg är tom ");
             closeModal("cartCheckoutModal");
             return;
         }

         const firstName = document.getElementById("cartCheckoutFirstName").value.trim();
         const lastName = document.getElementById("cartCheckoutLastName").value.trim();
         const phone = document.getElementById("cartCheckoutPhone").value.trim();
         const email = document.getElementById("cartCheckoutEmail").value.trim();
         const delivery = selectedDelivery;
         const address = document.getElementById("cartCheckoutAddress").value.trim();
         const postal = document.getElementById("cartCheckoutPostal").value.trim();
         const city = document.getElementById("cartCheckoutCity").value.trim();
         const message = document.getElementById("cartCheckoutMessage").value.trim();

         if (!firstName || !lastName || !phone || !email) {
             alert("Fyll i förnamn, efternamn, telefonnummer och e-post ");
             return;
         }

         if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
             alert("Kontrollera e-postadressen. Den måste innehålla @ och en giltig domän med punkt.");
             return;
         }

         const phoneDigits = phone.replace(/\D/g, "");
         if (!/^0\d{9}$/.test(phoneDigits) || phone !== phoneDigits) {
             alert("Ange ett svenskt telefonnummer med exakt 10 siffror, utan mellanslag eller +46.");
             document.getElementById("cartCheckoutPhone").focus();
             return;
         }

         if (delivery === "shipping" && (!address || !postal || !city)) {
             alert("Fyll i adress, postnummer och ort för frakt ");
             return;
         }
         if (delivery === "shipping" && !/^\d{3} ?\d{2}$/.test(postal)) {
             alert("Postnumret måste bestå av exakt fem siffror, till exempel 123 45.");
             return;
         }

         const button = document.querySelector('#cartCheckoutModal button[onclick="finalizeCartCheckout()"]');
         const originalButtonText = button ? button.textContent : "Skicka beställning →";

         try {
             if (button) {
                 button.disabled = true;
                 button.textContent = "Skapar mejlfil...";
                 button.style.opacity = "0.7";
                 button.style.cursor = "wait";
             }

             const fullAddress = delivery === "shipping" ? `${address}, ${postal} ${city}` : "";
             const body = buildOrderEmailBody(
                 firstName, lastName, phone, email, delivery, fullAddress, message
             );

             // Bifoga uppladdade inspo-bilder direkt i mejlfilen.
             const attachments = [];
             cart.forEach((item, itemIndex) => {
                 const data = item?.options?.inspoData;
                 if (!data || typeof data !== "string" || !data.startsWith("data:")) return;

                 const match = data.match(/^data:([^;,]+)?;base64,(.+)$/);
                 if (!match) return;

                 attachments.push({
                     name: getInspoAttachmentName(item, itemIndex + 1, match[1]),
                     mimeType: match[1] || "application/octet-stream",
                     base64: match[2]
                 });
             });


             const subject = `Beställning från ${firstName} ${lastName} – PressN’Pop`;
             if (button) button.textContent = "Skickar beställning...";

             // Försök skicka beställningen automatiskt till PressN'Pop.
             let sentAutomatically = false;
             try {
                 sentAutomatically = await sendOrderAutomatically(
                     subject, body, `${firstName} ${lastName}`, email, attachments,
                     (current, total) => {
                         if (button) button.textContent = total > 1
                             ? `Skickar bild ${current} av ${total} automatiskt...`
                             : "Skickar beställning...";
                     }
                 );
             } catch (sendError) {
                 console.warn("Automatiskt utskick misslyckades:", sendError);
             }

             if (sentAutomatically) {
                 cart = [];
                 saveCart();
                 closeModal("cartCheckoutModal");
                 closeModal("cartModal");
                 alert(
                     "Tack för din beställning! \n\n" +
                     "Din beställning har skickats till PressN’Pop. Vi återkommer med information om betalning via Swish och leverans."
                 );
             } else {
                 // Reservlösning: ladda ner färdigt mejl som kunden skickar själv.
                 await createOrderEmailFile("pressnpop.uf@gmail.com", subject, body, attachments);
                 closeModal("cartCheckoutModal");
                 alert(
                     "Vi kunde inte skicka beställningen automatiskt" + (window.lastOrderSendError ? " (" + window.lastOrderSendError + ")" : "") + ". \n\n" +
                     "Ett färdigt beställningsmejl har laddats ner i stället:\n" +
                     "1. Öppna filen PressNPop-bestallning.eml i ditt e-postprogram.\n" +
                     "2. Tryck på Skicka för att mejla beställningen till pressnpop.uf@gmail.com.\n\n" +
                     "Beställningen är inte skickad förrän du själv trycker på Skicka. Varukorgen är kvar tills dess."
                 );
             }
         } catch (error) {
             console.error("Kunde inte skapa beställningsmejlet:", error);
             alert("Beställningsmejlet kunde inte skapas. Försök igen eller kontakta pressnpop.uf@gmail.com.");
         } finally {
             if (button) {
                 button.disabled = false;
                 button.textContent = originalButtonText;
                 button.style.opacity = "";
                 button.style.cursor = "";
             }
         }
     }

    /* =====================================================
       STORLEKSDATA
    ===================================================== */

    const nailSizes = {
        Square: {
            Medium: {0:"17,0 mm",1:"16,0 mm",2:"15,0 mm",3:"14,0 mm",4:"13,0 mm",5:"12,0 mm",6:"12,0 mm",7:"11,0 mm",8:"11,0 mm",9:"10,0 mm",10:"9,0 mm",11:"8,0 mm"},
            Short: {0:"17,0 mm",1:"16,0 mm",2:"15,0 mm",3:"14,0 mm",4:"13,0 mm",5:"12,0 mm",6:"12,0 mm",7:"11,0 mm",8:"11,0 mm",9:"10,0 mm",10:"9,0 mm",11:"8,0 mm"},
            "Extra short": {0:"17,0 mm",1:"16,0 mm",2:"15,0 mm",3:"14,0 mm",4:"13,0 mm",5:"12,0 mm",6:"12,0 mm",7:"11,0 mm",8:"11,0 mm",9:"10,0 mm",10:"9,0 mm",11:"8,0 mm"}
        },
        Coffin: {
            Medium: {0:"16,5 mm",1:"16,0 mm",2:"15,0 mm",3:"14,5 mm",4:"14,0 mm",5:"12,5 mm",6:"12,0 mm",7:"11,5 mm",8:"11,0 mm",9:"10,5 mm",10:"9,5 mm",11:"8,5 mm"},
            Short: {0:"16,5 mm",1:"16,0 mm",2:"15,0 mm",3:"14,5 mm",4:"14,0 mm",5:"12,5 mm",6:"12,0 mm",7:"11,5 mm",8:"11,0 mm",9:"10,5 mm",10:"9,5 mm",11:"8,5 mm"},
            "Extra short": {0:"16,5 mm",1:"16,0 mm",2:"15,0 mm",3:"14,5 mm",4:"14,0 mm",5:"12,5 mm",6:"12,0 mm",7:"11,5 mm",8:"11,0 mm",9:"10,5 mm",10:"9,5 mm",11:"8,5 mm"}
        },
        Almond: {
            Medium: {0:"17,0 mm",1:"16,0 mm",2:"15,0 mm",3:"14,0 mm",4:"13,0 mm",5:"12,5 mm",6:"12,0 mm",7:"11,5 mm",8:"11,0 mm",9:"10,5 mm",10:"9,5 mm",11:"8,5 mm"},
            Short: {0:"19,0 mm",1:"17,5 mm",2:"16,0 mm",3:"15,0 mm",4:"14,5 mm",5:"14,0 mm",6:"13,5 mm",7:"13,0 mm",8:"12,0 mm",9:"11,0 mm",10:"10,0 mm",11:"9,0 mm"}
        }
    };

    function getNailSizeChart(form = "Almond", length = "Medium") {
        const formCharts = nailSizes[form] || nailSizes.Almond;
        const chartLength = length === "XX Short" || length === "XXShort" ? "Extra short" : length;
        return formCharts[chartLength] || formCharts.Medium || formCharts.Short || nailSizes.Almond.Medium;
    }



    const toeSizes = {
        "00": "23 mm",
        "0": "21,5 mm",
        "1": "20,5 mm",
        "2": "20 mm",
        "3": "19 mm",
        "4": "18 mm",
        "5": "15 mm",
        "6": "14 mm",
        "7": "13 mm",
        "8": "12 mm",
        "9": "10,5 mm",
        "10": "10 mm",
        "11": "9 mm",
        "12": "8 mm",
        "13": "7 mm"
    };


    /* =====================================================
       STORLEKSFUNKTIONER
    ===================================================== */

    function createSizeOptions(selectId, sizes, placeholder = "Välj") {

        const select = document.getElementById(selectId);

        if (!select) return;

        select.innerHTML = `<option value="">${placeholder}</option>`;

        const orderedSizes = sizes === toeSizes
            ? ["00", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"]
            : Object.keys(sizes);

        orderedSizes.forEach(size => {

            const option = document.createElement("option");

            option.value = size;

            const displayedSize = sizes === toeSizes
                ? String(size)
                : String(size).padStart(2, "0");
            option.textContent = `Storlek ${displayedSize} – ${sizes[size]}`;

            select.appendChild(option);

        });
    }


    function setupNailSizeSelectors(prefix, form, length = "Medium") {

        const sizes = getNailSizeChart(form, length);

        const ids = [
            prefix + "Thumb",
            prefix + "Index",
            prefix + "Middle",
            prefix + "Ring",
            prefix + "Pinky"
        ];

        ids.forEach(id => {
            createSizeOptions(id, sizes);
        });
    }


    function getNailSizeValues(prefix) {

        return {

            thumb:
                document.getElementById(prefix + "Thumb").value,

            index:
                document.getElementById(prefix + "Index").value,

            middle:
                document.getElementById(prefix + "Middle").value,

            ring:
                document.getElementById(prefix + "Ring").value,

            pinky:
                document.getElementById(prefix + "Pinky").value

        };

    }


    function allNailSizesSelected(prefix) {

        const sizes = getNailSizeValues(prefix);

        return (
            sizes.thumb !== "" &&
            sizes.index !== "" &&
            sizes.middle !== "" &&
            sizes.ring !== "" &&
            sizes.pinky !== ""
        );
    }


    function formatNailSizes(prefix, form, length = "Medium") {

        const sizes = getNailSizeValues(prefix);
        const measurements = getNailSizeChart(form, length);

        return `
            <p>Tumme: storlek ${sizes.thumb} (${measurements[sizes.thumb]})</p>
            <p>Pekfinger: storlek ${sizes.index} (${measurements[sizes.index]})</p>
            <p>Långfinger: storlek ${sizes.middle} (${measurements[sizes.middle]})</p>
            <p>Ringfinger: storlek ${sizes.ring} (${measurements[sizes.ring]})</p>
            <p>Lillfinger: storlek ${sizes.pinky} (${measurements[sizes.pinky]})</p>
        `;
    }


    function setupCustomToeSizeSelectors() {
        [
            ["customToeThumbSize", "Stortå"],
            ["customToeIndexSize", "Tå 2"],
            ["customToeMiddleSize", "Tå 3"],
            ["customToeRingSize", "Tå 4"],
            ["customToePinkySize", "Lilltå"]
        ].forEach(([id]) => createSizeOptions(id, toeSizes, "Välj storlek"));
    }

    function getCustomToeSizeValues() {
        return {
            thumb: document.getElementById("customToeThumbSize")?.value || "",
            index: document.getElementById("customToeIndexSize")?.value || "",
            middle: document.getElementById("customToeMiddleSize")?.value || "",
            ring: document.getElementById("customToeRingSize")?.value || "",
            pinky: document.getElementById("customToePinkySize")?.value || ""
        };
    }

    function allCustomToeSizesSelected(sizes) {
        return Object.values(sizes).every(value => value !== "");
    }

    function setupToeSizes() {

        createSizeOptions(
            "toeOrderSize",
            toeSizes,
            "Välj storlek"
        );

    }


    /* =====================================================
       FÄRDIGA NAGLAR
    ===================================================== */

    let orderData = {
        design: "",
        size: {
            thumb: "",
            index: "",
            middle: "",
            ring: "",
            pinky: ""
        }
    };


    function openOrder(design) {

        orderData = {
            design: design || "",
            size: {
                thumb: "",
                index: "",
                middle: "",
                ring: "",
                pinky: ""
            }
        };

        document
            .getElementById("orderModal")
            .classList.add("active");

        showOrderStep(1);

        document
            .querySelectorAll("#orderStep1 .option")
            .forEach(option => {

                option.classList.remove("selected");

                if (option.textContent.trim() === design) {
                    option.classList.add("selected");
                }

            });

    }


    function selectOrderOption(element, type, value) {

        const parent = element.parentElement;

        parent.querySelectorAll(".option").forEach(option => {
            option.classList.remove("selected");
        });

        element.classList.add("selected");

        orderData[type] = value;
    }


    function showOrderStep(number) {

        document
            .querySelectorAll("#orderModal .step")
            .forEach(step => step.classList.remove("active"));

        const step =
            document.getElementById("orderStep" + number);

        if (step) {
            step.classList.add("active");
        }

        document
            .querySelectorAll(".order-progress")
            .forEach((bar, index) => {

                bar.classList.toggle(
                    "active",
                    index < number
                );

            });


        if (number === 2) {

            setupNailSizeSelectors("order", "Almond");

        }


        if (number === 3) {

            const sizes =
                getNailSizeValues("order");

            document.getElementById("orderSummary").innerHTML = `

                <strong>Din beställning</strong>

                <p>
                    Design: ${orderData.design || "Inte vald"}
                </p>

                <p><strong>Storlekar:</strong></p>

                <p>
                    Tumme: storlek ${sizes.thumb}
                </p>

                <p>
                    Pekfinger: storlek ${sizes.index}
                </p>

                <p>
                    Långfinger: storlek ${sizes.middle}
                </p>

                <p>
                    Ringfinger: storlek ${sizes.ring}
                </p>

                <p>
                    Lillfinger: storlek ${sizes.pinky}
                </p>

            `;

        }

    }


    function nextOrderStep(number) {

        if (number === 2 && !orderData.design) {

            alert("Välj en design först ");
            return;

        }


        if (number === 3) {

            if (!allNailSizesSelected("order")) {

                alert("Välj en storlek för alla fem fingrar ");
                return;

            }

        }


        showOrderStep(number);

    }


    async function submitOrder() {
        const message = document.getElementById("orderMessage").value.trim();
        const sizes = getNailSizeValues("order");
        if (!orderData.design) return alert("Välj en design först ");
        if (!allNailSizesSelected("order")) return alert("Välj en storlek för alla fem fingrar ");
        addItemToCart({ cartId:makeCartId(), type:"ready_nails", productId:"nail-"+slugify(orderData.design), name:orderData.design, image:(readyProducts.find(product => product.name === orderData.design)?.image || "bilder/vanillavibe1.jpg"), color:orderData.color || "Original", length:orderData.length || "", sizes, quantity:getModalQuantity("orderQuantity"), customer:null, options:{design:orderData.design,color:orderData.color || "Original",length:orderData.length || "",sizes,message} });
        closeModal("orderModal");
        openCart();
    }



    /* =====================================================
       FÄRDIGA TÅR
    ===================================================== */

    let toeOrderData = {
        design: "",
        sizes: { big: "", second: "", third: "", fourth: "", pinky: "" },
        color: ""
    };


    function selectRegularToeDesign(button, design) {
        selectToeOrderOption(button, 'design', design);
        const colorChoice = document.getElementById('frenchToeColorChoice');
        if (colorChoice) colorChoice.style.display = 'none';
    }

    function selectFrenchToeDesign(button) {
        selectToeOrderOption(button, 'design', 'French Toes');
        const colorChoice = document.getElementById('frenchToeColorChoice');
        if (colorChoice) colorChoice.style.display = 'block';
    }

    function openToeOrder(design) {
        // Tår ska använda exakt samma produktvy som Våra Naglar:
        // bildgalleri till vänster och färg/storlek/antal till höger.
        openToeProductDetail(design);
    }


    function selectToeOrderOption(element, type, value) {

        const parent = element.parentElement;

        parent.querySelectorAll(".option").forEach(option => {
            option.classList.remove("selected");
        });

        element.classList.add("selected");

        toeOrderData[type] = value;

    }


    function toeImageBase() {
        return 6;
    }

    function renderToeOrderGallery() {
        const main = document.getElementById("toeOrderMainImage");
        const thumbs = document.getElementById("toeOrderThumbs");
        if (!main || !thumbs) return;
        const images = ["bilder/fransktar1.jpeg", "bilder/fransktar2.jpeg"];
        main.src = images[0];
        main.alt = "French Toes";
        main.onerror = () => { main.src = images[1]; };
        thumbs.innerHTML = "";
        images.forEach((src, i) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "gallery-thumb" + (i === 0 ? " active" : "");
            b.innerHTML = `<img src="${src}" alt="${toeOrderData.design} bild ${i+1}">`;
            const im = b.querySelector("img");
            im.onerror = () => { im.src = `bilder/tå${n}.jpg`; };
            b.onclick = () => {
                main.src = src;
                main.onerror = () => { main.src = `bilder/tå${n}.jpg`; };
                thumbs.querySelectorAll(".gallery-thumb").forEach(x => x.classList.remove("active"));
                b.classList.add("active");
            };
            thumbs.appendChild(b);
        });
    }

    function renderToeOrderSizes() {
        [
            ["toeOrderBig", "big"], ["toeOrderSecond", "second"], ["toeOrderThird", "third"],
            ["toeOrderFourth", "fourth"], ["toeOrderPinky", "pinky"]
        ].forEach(([id, key]) => {
            createSizeOptions(id, toeSizes, "Välj storlek");
            const el = document.getElementById(id);
            if (el) el.value = toeOrderData.sizes[key] || "";
        });
    }

    function getToeSizesFromForm() {
        return {
            big: document.getElementById("toeOrderBig").value,
            second: document.getElementById("toeOrderSecond").value,
            third: document.getElementById("toeOrderThird").value,
            fourth: document.getElementById("toeOrderFourth").value,
            pinky: document.getElementById("toeOrderPinky").value
        };
    }

    function allToeSizesSelected() {
        return Object.values(getToeSizesFromForm()).every(v => v !== "");
    }

    function renderToeOrderColors() {
        const container = document.getElementById("toeOrderColors");
        if (!container) return;
        const colors = [
            { name: "Original", value: "Original", hex: "#e8a7b8" },
            { name: "Baby pink", value: "Baby pink", hex: "#f7cbd8" },
            { name: "Nude", value: "Nude", hex: "#d8b09e" },
            { name: "Vit", value: "Vit", hex: "#ffffff" },
            { name: "Röd", value: "Röd", hex: "#b94b65" },
            { name: "Lavendel", value: "Lavendel", hex: "#c7b7dc" }
        ];
        container.innerHTML = "";
        colors.forEach((color, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "choice-button color-choice" + ((toeOrderData.color || index === 0) === color.value ? " selected" : "");
            button.innerHTML = `<span class="color-dot" style="background:${color.hex}"></span>${color.name}`;
            button.onclick = () => {
                toeOrderData.color = color.value;
                container.querySelectorAll(".choice-button").forEach(item => item.classList.remove("selected"));
                button.classList.add("selected");
            };
            container.appendChild(button);
        });
        if (!toeOrderData.color) toeOrderData.color = colors[0].value;
    }

    function showToeOrderStep(number) {

        document
            .querySelectorAll("#toeOrderModal .step")
            .forEach(step => step.classList.remove("active"));


        const step =
            document.getElementById("toeOrderStep" + number);


        if (step) {
            step.classList.add("active");
        }


        document
            .querySelectorAll(".toe-progress")
            .forEach((bar, index) => {

                bar.classList.toggle(
                    "active",
                    index < number
                );

            });


        if (number === 2) {
            renderToeOrderSizes();
        }


        if (number === 3) {
            document.getElementById("toeOrderSummary").innerHTML = `

                <strong>Din beställning</strong>

                <p>
                    Tådesign: ${toeOrderData.design || "Inte vald"}
                </p>
                <p>Färg: ${toeOrderData.color || "Original"}</p>

                <p><strong>Storlekar:</strong></p>
                <p>Stortå: ${toeOrderData.sizes.big || "Inte vald"}</p>
                <p>Tå 2: ${toeOrderData.sizes.second || "Inte vald"}</p>
                <p>Tå 3: ${toeOrderData.sizes.third || "Inte vald"}</p>
                <p>Tå 4: ${toeOrderData.sizes.fourth || "Inte vald"}</p>
                <p>Lilltå: ${toeOrderData.sizes.pinky || "Inte vald"}</p>

            `;

        }

    }


    function nextToeOrderStep(number) {

        if (number === 2 && !toeOrderData.design) {
            alert("Välj en tådesign först ");
            return;
        }

        if (number === 2 && !toeOrderData.color) {
            alert("Välj en färg först ");
            return;
        }


        if (number === 3) {
            const sizes = getToeSizesFromForm();
            if (!Object.values(sizes).every(v => v !== "")) {
                alert("Välj en storlek för alla fem tår ");
                return;
            }
            toeOrderData.sizes = sizes;
        }


        showToeOrderStep(number);

    }


    async function submitToeOrder() {
        const message = "";
        const sizes = getToeSizesFromForm();
        if (!toeOrderData.design || !allToeSizesSelected()) return alert("Välj design och storlek för alla fem tår först ");
        toeOrderData.sizes = sizes;
        addItemToCart({ cartId:makeCartId(), type:"ready_toes", productId:"toe-"+slugify(toeOrderData.design), name:toeOrderData.design, image:`bilder/tå${toeImageBase(toeOrderData.design)}.jpg`, color:toeOrderData.color || "Original", length:"", sizes, quantity:getModalQuantity("toeOrderQuantity"), customer:null, options:{design:toeOrderData.design,color:toeOrderData.color || "Original",sizes,sizeMeasurements:Object.fromEntries(Object.entries(sizes).map(([k,v])=>[k,toeSizes[v]||""])),message} });
        closeModal("toeOrderModal");
        openCart();
    }


    /* =====================================================
       CUSTOM NAGLAR
    ===================================================== */

    let customNailData = {

        color: "",
        form: "",
        length: "",
        size: {
            thumb: "",
            index: "",
            middle: "",
            ring: "",
            pinky: ""
        },
        inspo: "",
        changes: ""

    };


    function openCustomNails() {

        customNailData = {

            color: "",
            form: "",
            length: "",
            size: {
                thumb: "",
                index: "",
                middle: "",
                ring: "",
                pinky: ""
            },
            inspo: "",
                changes: ""

        };


        document.getElementById("customNailQuantity").textContent="1";
        document.querySelectorAll("#customNailStep1 .option").forEach(option => option.classList.remove("selected"));
        document.querySelectorAll("#customNailStep3 .option").forEach(option => {
            option.style.display = "";
            option.classList.remove("selected");
        });
        document
            .getElementById("customNailsModal")
            .classList.add("active");


        showCustomNailStep(1);

    }


    function selectCustomNail(element, type, value) {

        const parent =
            element.parentElement;


        parent
            .querySelectorAll(".option")
            .forEach(option => {
                option.classList.remove("selected");
            });


        element.classList.add("selected");


        customNailData[type] = value;

        // Almond finns bara i Short och Medium. Dölj de kortaste längderna
        // när Almond väljs, och rensa en eventuell ogiltig tidigare markering.
        if (type === "form") {
            const lengthOptions = document.querySelectorAll("#customNailStep3 .option");
            lengthOptions.forEach(option => {
                const isXShort = option.textContent.includes("X Short") && !option.textContent.includes("XX Short");
                const isXXShort = option.textContent.includes("XX Short");
                const shouldHide = value === "Almond" && (isXShort || isXXShort);
                option.style.display = shouldHide ? "none" : "";
                if (shouldHide) option.classList.remove("selected");
            });
            if (value === "Almond" && ["Extra Short", "XX Short"].includes(customNailData.length)) {
                customNailData.length = "";
            }
        }

    }


    function showCustomNailStep(number) {

        document
            .querySelectorAll("#customNailsModal .step")
            .forEach(step => step.classList.remove("active"));


        const step =
            document.getElementById("customNailStep" + number);


        if (step) {
            step.classList.add("active");
        }


        document
            .querySelectorAll(".custom-nail-progress")
            .forEach((bar, index) => {

                bar.classList.toggle(
                    "active",
                    index < number
                );

            });


        if (number === 4) {

            setupNailSizeSelectors(
                "custom",
                customNailData.form || "Almond",
                customNailData.length || "Medium"
            );

        }


        if (number === 7) {

            const inspo =
                document.getElementById("customNailInspo").files[0];

            const changes =
                document.getElementById("customNailChanges").value.trim();


            document
                .getElementById("customNailSummary")
                .innerHTML = `

                <strong>Din custom-design</strong>
                <p>Basfärg: ${customNailData.color || "Inte vald"}</p>

                <p>
                    Form: ${customNailData.form || "Inte vald"}
                </p>

                <p>
                    Längd: ${customNailData.length || "Inte vald"}
                </p>

                <p><strong>Storlekar:</strong></p>

                ${formatNailSizes(
                    "custom",
                    customNailData.form || "Almond",
                    customNailData.length || "Medium"
                )}

                <p>
                    Inspo-bild:
                    ${inspo ? inspo.name : "Ingen bild vald"}
                </p>

                <p>
                    Ändringar:
                    ${changes || "Inga särskilda ändringar angivna"}
                </p>

            `;

        }

    }


    function nextCustomNailStep(number) {

        if (number === 2 && !customNailData.color) {
            alert("Välj en basfärg först");
            return;
        }

        if (number === 3 && !customNailData.form) {

            alert("Välj en nagelform först ");
            return;

        }


        if (number === 4 && !customNailData.length) {

            alert("Välj en längd först ");
            return;

        }


        if (number === 5) {

            if (!allNailSizesSelected("custom")) {

                alert("Välj en storlek för alla fem fingrar ");
                return;

            }

        }


        if (number === 6) {

            const inspo =
                document.getElementById("customNailInspo").files[0];


            if (!inspo) {

                alert("Ladda upp en inspo-bild först ");
                return;

            }


        }


        showCustomNailStep(number);

    }


    async function submitCustomNails() {
        const changes = document.getElementById("customNailChanges").value.trim();
        const inspo = document.getElementById("customNailInspo").files[0];
        const sizes = getNailSizeValues("custom");
        if (!inspo) return alert("Ladda upp en inspo-bild först ");
        if (!allNailSizesSelected("custom")) return alert("Välj storlek för alla fem fingrar ");
        let inspoData;
        try {
            inspoData = await fileToInspoData(inspo);
        } catch (error) {
            alert(error.message || "Bilden kunde inte komprimeras. Prova en annan bild.");
            return;
        }
        addItemToCart({ cartId:makeCartId(), type:"custom_nails",
            unitPrice:399, productId:"custom_nails", name:"Custom Nails", image:extraPlaceholder("Custom Nails"), color:customNailData.color||"", length:customNailData.length||"", sizes, quantity:getModalQuantity("customNailQuantity"), customer:null, options:{color:customNailData.color,form:customNailData.form,length:customNailData.length,sizes,changes,inspoFile:inspo.name,inspoData} });
        closeModal("customNailsModal");
        openCart();
    }


    /* =====================================================
       CUSTOM TÅR
    ===================================================== */

    let customToeData = {
        color: "",
        length: "",
        sizes: {
            thumb: "",
            index: "",
            middle: "",
            ring: "",
            pinky: ""
        },
        inspo: "",
        changes: ""
    };


    function openCustomToes() {

        customToeData = {
            color: "",
            length: "",
            sizes: {
                thumb: "",
                index: "",
                middle: "",
                ring: "",
                pinky: ""
            },
            inspo: "",
            changes: ""
        };


        document.getElementById("customToeQuantity").textContent="1";
        document.querySelectorAll("#customToeStep1 .option").forEach(option => option.classList.remove("selected"));
        document
            .getElementById("customToesModal")
            .classList.add("active");


        showCustomToeStep(1);

    }



    function selectCustomToeColor(element, value) {
        element.parentElement.querySelectorAll(".option").forEach(option => option.classList.remove("selected"));
        element.classList.add("selected");
        customToeData.color = value;
    }

    function selectCustomToeLength(element, value) {
        element.parentElement.querySelectorAll(".option").forEach(option => option.classList.remove("selected"));
        element.classList.add("selected");
        customToeData.length = value;
    }

    function showCustomToeStep(number) {

        document
            .querySelectorAll("#customToesModal .step")
            .forEach(step => step.classList.remove("active"));


        const step =
            document.getElementById("customToeStep" + number);


        if (step) {
            step.classList.add("active");
        }


        document
            .querySelectorAll(".custom-toe-progress")
            .forEach((bar, index) => {

                bar.classList.toggle(
                    "active",
                    index < number
                );

            });


        if (number === 3) {
            setupCustomToeSizeSelectors();
        }


        if (number === 6) {

            const inspo =
                document.getElementById("customToeInspo").files[0];

            const changes = "";


            document
                .getElementById("customToeSummary")
                .innerHTML = `

                <strong>Din custom-tådesign</strong>
                <p>Basfärg: ${customToeData.color || "Inte vald"}</p>
                <p>Längd: ${customToeData.length || "Inte vald"}</p>

                <p><strong>Storlekar:</strong></p>
                <p>Stortå: ${customToeData.sizes.thumb || "Inte vald"} ${customToeData.sizes.thumb ? "(" + toeSizes[customToeData.sizes.thumb] + ")" : ""}</p>
                <p>Tå 2: ${customToeData.sizes.index || "Inte vald"} ${customToeData.sizes.index ? "(" + toeSizes[customToeData.sizes.index] + ")" : ""}</p>
                <p>Tå 3: ${customToeData.sizes.middle || "Inte vald"} ${customToeData.sizes.middle ? "(" + toeSizes[customToeData.sizes.middle] + ")" : ""}</p>
                <p>Tå 4: ${customToeData.sizes.ring || "Inte vald"} ${customToeData.sizes.ring ? "(" + toeSizes[customToeData.sizes.ring] + ")" : ""}</p>
                <p>Lilltå: ${customToeData.sizes.pinky || "Inte vald"} ${customToeData.sizes.pinky ? "(" + toeSizes[customToeData.sizes.pinky] + ")" : ""}</p>

                <p>
                    Inspo-bild:
                    ${inspo ? inspo.name : "Ingen bild vald"}
                </p>

                <p>
                    Ändringar:
                    ${changes || "Inga särskilda ändringar angivna"}
                </p>

            `;

        }

    }


    function toggleSiteDetailMenu() {
        const menu = document.getElementById("siteDetailMenu");
        const button = document.querySelector(".site-menu-toggle");
        const willOpen = menu.hasAttribute("hidden");
        if (willOpen) menu.removeAttribute("hidden"); else menu.setAttribute("hidden", "");
        button.setAttribute("aria-expanded", String(willOpen));
    }

    function closeSiteDetailMenu() {
        const menu = document.getElementById("siteDetailMenu");
        const button = document.querySelector(".site-menu-toggle");
        menu.setAttribute("hidden", "");
        button.setAttribute("aria-expanded", "false");
    }

    function openMenuProduct(name) {
        closeSiteDetailMenu();
        // Let the page move to the nail collection before opening the existing product detail.
        const section = document.getElementById("naglar");
        if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
        window.setTimeout(() => openProductDetailByName(name), 250);
    }

    function nextCustomToeStep(number) {

        if (number === 2 && !customToeData.color) {
            alert("Välj en basfärg först");
            return;
        }

        if (number === 3 && !customToeData.length) {
            alert("Välj en längd först");
            return;
        }

        if (number === 4) {
            const sizes = getCustomToeSizeValues();

            if (!allCustomToeSizesSelected(sizes)) {
                alert("Välj storlek för alla 5 tår ");
                return;
            }

            customToeData.sizes = sizes;
        }


        if (number === 5) {

            const inspo =
                document.getElementById("customToeInspo").files[0];


            if (!inspo) {

                alert("Ladda upp en inspo-bild först ");
                return;

            }

        }


        showCustomToeStep(number);

    }


    async function submitCustomToes() {
        const changes = document.getElementById("customToeChanges").value.trim();
        const inspo = document.getElementById("customToeInspo").files[0];
        const sizes = getCustomToeSizeValues();

        if (!inspo) return alert("Ladda upp en inspo-bild först ");
        if (!allCustomToeSizesSelected(sizes)) return alert("Välj storlek för alla 5 tår ");

        let inspoData;
        try {
            inspoData = await fileToInspoData(inspo);
        } catch (error) {
            alert(error.message || "Bilden kunde inte komprimeras. Prova en annan bild.");
            return;
        }

        addItemToCart({
            cartId: makeCartId(),
            type: "custom_toes",
            unitPrice: 399,
            productId: "custom_toes",
            name: "Custom Toes",
            image: extraPlaceholder("Custom Toes"),
            color: customToeData.color || "",
            length: customToeData.length || "",
            sizes,
            quantity: getModalQuantity("customToeQuantity"),
            customer: null,
            options: {
                color: customToeData.color,
                length: customToeData.length,
                sizes,
                sizeMeasurements: {
                    thumb: toeSizes[sizes.thumb] || "",
                    index: toeSizes[sizes.index] || "",
                    middle: toeSizes[sizes.middle] || "",
                    ring: toeSizes[sizes.ring] || "",
                    pinky: toeSizes[sizes.pinky] || ""
                },
                changes,
                inspoFile: inspo.name,
                inspoData
            }
        });

        closeModal("customToesModal");
        openCart();
    }


    /* =====================================================
       VISA UPPLADDADE FILNAMN
    ===================================================== */

    async function showFileName(inputId, outputId) {
        const input = document.getElementById(inputId);
        const output = document.getElementById(outputId);
        if (!input || !output) return;

        // Hindra ett äldre komprimeringsresultat från att skriva över en ny bild.
        const requestId = String((Number(output.dataset.previewRequest || 0) + 1));
        output.dataset.previewRequest = requestId;

        if (!input.files || !input.files.length) {
            output.textContent = "";
            return;
        }

        const file = input.files[0];
        output.textContent = "Komprimerar bilden för att beräkna storleken…";

        try {
            const compressedData = await fileToInspoData(file);
            if (output.dataset.previewRequest !== requestId) return;

            const base64 = compressedData.split(",")[1] || "";
            const padding = base64.endsWith("==") ? 2 : (base64.endsWith("=") ? 1 : 0);
            const compressedBytes = Math.max(0, Math.floor(base64.length * 3 / 4) - padding);
            const compressedKB = compressedBytes / 1024;
            const sizeLabel = compressedKB >= 1024
                ? (compressedKB / 1024).toFixed(2).replace(".", ",") + " MB"
                : Math.max(1, Math.round(compressedKB)) + " KB";

            output.textContent = "Efter komprimering: cirka " + sizeLabel;
        } catch (error) {
            if (output.dataset.previewRequest !== requestId) return;
            output.textContent = "Bilden kunde inte komprimeras. Prova en annan bild.";
        }
    }


    /* =====================================================
       STÄNG MODAL
    ===================================================== */

    function closeModal(id) {

        document
            .getElementById(id)
            .classList.remove("active");

    }


    window.addEventListener("click", function(event) {

        const modals = [
            "orderModal",
            "toeOrderModal",
            "customNailsModal",
            "customToesModal"
        ];


        modals.forEach(id => {

            const modal =
                document.getElementById(id);


            if (event.target === modal) {

                closeModal(id);

            }

        });

    });


    /* =====================================================
       STARTA STORLEKSFUNKTIONER
    ===================================================== */

    setupToeSizes();



    /* =====================================================
       PRODUKTER + VARUKORG
       Frontend-varukorg sparas lokalt i webbläsaren.
    ===================================================== */

    const readyToes = [
        { name: "French Toes", price: 349, description: "French Toes har en klassisk french-design. Välj basfärg mellan Light Pink, Pink, Nude eller Peach för att anpassa uttrycket.", gelInfo: "Alla våra geler är starka, hållbara, köpta från Sverige och fria från skadliga kemikalier.", image: "bilder/fransktar1.jpeg", images: ["bilder/fransktar1.jpeg", "bilder/fransktar2.jpeg"] }
    ];

    const toeColors = [
        { name: "Original", value: "Original", hex: "#e8a7b8" },
        { name: "Baby pink", value: "Baby pink", hex: "#f7cbd8" },
        { name: "Nude", value: "Nude", hex: "#d8b09e" },
        { name: "Vit", value: "Vit", hex: "#ffffff" },
        { name: "Röd", value: "Röd", hex: "#b94b65" },
        { name: "Lavendel", value: "Lavendel", hex: "#c7b7dc" }
    ];

    const readyProducts = [
        {
            id: 1,
            name: "Nude", price: 199,
            description: "Nude är ett klassiskt enfärgat set i en mjuk nude nyans för en ren, naturlig och minimalistisk look. ", gelInfo: "Naglarna är byggda med gelén DUNE från Chewali som är en nude nyans. Alla våra geler är starka, hållbara, köpta från Sverige och fria från skadliga kemikalier.",
            image: "bilder/vanillavibe1.jpg",
            images: ["bilder/vanillavibe1.jpg", "bilder/vanillavibe2.jpg"],
            colors: [
                { name: "Original rosa", value: "Original rosa", hex: "#e7a1b8" },
                { name: "Baby pink", value: "Baby pink", hex: "#f7cbd8" },
                { name: "Vit", value: "Vit", hex: "#ffffff" },
                { name: "Röd", value: "Röd", hex: "#b94b65" }
            ]
        },


        {
            id: 2,
            name: "Pink French", price: 299,
            description: "Pink French är en klassisk vit fransk manikyr för en ren, fräsch och tidlös look som passar till alla tillfällen.", gelInfo: "Naglarna är byggda med gelén FANCY PINK från Missfancy som är en rosa nyans. Alla våra geler är starka, hållbara, köpta från Sverige och fria från skadliga kemikalier.",
            image: "bilder/pearlpress1.jpg",
            images: ["bilder/pearlpress1.jpg", "bilder/pearlpress2.jpg"],
            colors: [
                { name: "Original röd", value: "Original röd", hex: "#b94b65" },
                { name: "Mörkröd", value: "Mörkröd", hex: "#8d2946" },
                { name: "Rosa", value: "Rosa", hex: "#e8a7bb" },
                { name: "Vit", value: "Vit", hex: "#ffffff" }
            ]
        },
        {
            id: 3,
            name: "Pink Flower", price: 349,
            description: "Pink Flower har 3D-blomma, guldpärlor och 3D-swirls för en lekfull och detaljrik look som verkligen märks.", gelInfo: "Naglarna är byggda med gelén FANCY PINK från Missfancy som är en rosa nyans. Alla våra geler är starka, hållbara, köpta från Sverige och fria från skadliga kemikalier.",
            image: "bilder/bubblebliss1.jpg",
            images: ["bilder/bubblebliss1.jpg", "bilder/bubblebliss2.jpg"],
            colors: [
                { name: "Original", value: "Original", hex: "#e9c1cc" },
                { name: "Rosa", value: "Rosa", hex: "#e8a7bb" },
                { name: "Vit", value: "Vit", hex: "#ffffff" },
                { name: "Lavendel", value: "Lavendel", hex: "#c7b7dc" }
            ]
        },
        {
            id: 4,
            name: "Nude Leo", price: 349,
            description: "Nude Leo har leopardmönster, lite 3D-swirl och guldpärlor för en piffig och uttrycksfull look med mycket personlighet.", gelInfo: "Naglarna är byggda med gelén DUNE från Chewali som är en nude nyans. Alla våra geler är starka, hållbara, köpta från Sverige och fria från skadliga kemikalier.",
            image: "bilder/sugerswirl1.jpg",
            images: ["bilder/sugerswirl1.jpg", "bilder/sugerswirl2.jpg"],
            colors: [
                { name: "Original rosa/guld", value: "Original rosa/guld", hex: "#dca7a9" },
                { name: "Champagne", value: "Champagne", hex: "#e7d0a6" },
                { name: "Rosa", value: "Rosa", hex: "#e8a7bb" },
                { name: "Vit", value: "Vit", hex: "#ffffff" }
            ]
        }
    ];

    function makeCartId() { return Date.now() + "-" + Math.random().toString(16).slice(2); }
    function slugify(value) { return String(value || "").toLowerCase().replace(/[^a-z0-9åäö]+/gi, "-").replace(/^-|-$/g, ""); }
    function changeModalQuantity(id, amount) { const el=document.getElementById(id); if(!el) return; el.textContent=Math.max(1,Math.min(99,Number(el.textContent||1)+amount)); }
    function getModalQuantity(id) { return Math.max(1,Math.min(99,Number(document.getElementById(id)?.textContent||1))); }
    // Komprimera varje inspo-bild separat så flera custom-set kan bifogas i samma mejl.
    // Max 1000 px och JPEG-kvalitet 0,65 minskar storleken rejält utan att bilden blir oläslig.
    async function fileToInspoData(file) {
        const compressWithDimensions = (source, width, height) => {
            const scale = Math.min(1, 1000 / Math.max(width, height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(width * scale));
            canvas.height = Math.max(1, Math.round(height * scale));
            const ctx = canvas.getContext("2d", { alpha: false });
            if (!ctx) throw new Error("Kunde inte skapa bildcanvas");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
            const result = canvas.toDataURL("image/jpeg", 0.65);
            if (!result.startsWith("data:image/jpeg;base64,")) throw new Error("JPEG-komprimering misslyckades");
            return result;
        };
        try {
            if (typeof createImageBitmap === "function") {
                const bitmap = await createImageBitmap(file);
                try { return compressWithDimensions(bitmap, bitmap.width, bitmap.height); }
                finally { if (bitmap.close) bitmap.close(); }
            }
            // Reserv för webbläsare som inte stöder createImageBitmap.
            const sourceUrl = await fileToDataURL(file);
            return await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    try { resolve(compressWithDimensions(img, img.naturalWidth || img.width, img.naturalHeight || img.height)); }
                    catch (err) { reject(err); }
                };
                img.onerror = () => reject(new Error("Bilden kunde inte läsas"));
                img.src = sourceUrl;
            });
        } catch (error) {
            console.error("Kunde inte komprimera inspo-bilden:", error);
            throw new Error("Bilden kunde inte komprimeras. Prova att ladda upp en JPG- eller PNG-bild.");
        }
    }

    function fileToDataURL(file) { return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file); }); }

    let cart = JSON.parse(localStorage.getItem("pressnpopCart") || "[]");
    const legacyNailNames = {
        "Vanilla Vibe": { name: "Nude", image: "bilder/vanillavibe1.jpg", price: 199 },
        "Pearl Press": { name: "Pink French", image: "bilder/pearlpress1.jpg", price: 299 },
        "Bubble Bliss": { name: "Pink Flower", image: "bilder/bubblebliss1.jpg", price: 349 },
        "Sugar Swirl": { name: "Nude Leo", image: "bilder/sugerswirl1.jpg", price: 349 }
    };
    if (Array.isArray(cart)) {
        cart = cart.map(item => {
            const legacy = legacyNailNames[item?.name];
            if (!legacy || !["ready_nails", undefined, null].includes(item?.type)) return item;
            return { ...item, name: legacy.name, image: legacy.image, unitPrice: legacy.price, productId: "nail-" + slugify(legacy.name), options: { ...(item.options || {}), design: legacy.name } };
        });
    } else {
        cart = [];
    }
    let selectedDelivery = localStorage.getItem("pnpDelivery") || "pickup";
    let currentProduct = null;
    let currentProductType = "nails";
    let currentProductState = {
        color: "",
        length: "Medium",
        form: "Almond",
        changes: "",
        quantity: 1
    };

    function addItemToCart(item) {
        if (!item || !item.name) return;

        const readyPriceByName = {
            "Nude": 199,
            "Pink French": 299,
            "Pink Flower": 349,
            "Nude Leo": 349,
            "French Toes": 349,
            "Vanilla Vibe": 199,
            "Pearl Press": 299,
            "Bubble Bliss": 349,
            "Sugar Swirl": 349
        };

        const normalized = {
            ...item,
            cartId: item.cartId || makeCartId(),
            quantity: Math.max(1, Math.min(99, Number(item.quantity) || 1)),
            unitPrice:
                item.type === "custom_nails" || item.type === "custom_toes"
                    ? 399
                    : Number(item.unitPrice ?? readyPriceByName[item.name] ?? item.price ?? 0)
        };

        cart.push(normalized);
        saveCart();
    }

    function saveCart() {
        if (!cart.some(isSetItem)) cart = cart.filter(item => !isProtectionItem(item));
        localStorage.setItem("pressnpopCart", JSON.stringify(cart));
        updateCartUI();
    }

    function getProductByName(name) {
        return readyProducts.find(product => product.name === name);
    }

    function openProductDetail(id) {
        const product = readyProducts.find(item => item.id === Number(id));
        if (!product) return;

        currentProductType = "nails";
        currentProduct = product;
        currentProductState = { color: "", length: "Medium", form: "Almond", changes: "", quantity: 1 };

        setupUnifiedProductModal(product, false);
    }

    function openToeProductDetail(name) {
        const product = readyToes.find(item => item.name === name);
        if (!product) return;

        currentProductType = "toes";
        currentProduct = { ...product, id: "toe-" + slugify(product.name), colors: product.name === "French Toes" ? [
            { name: "Light Pink", value: "Light Pink", hex: "#f7cbd8" },
            { name: "Pink", value: "Pink", hex: "#e99ab5" },
            { name: "Nude", value: "Nude", hex: "#d8b09e" },
            { name: "Peach", value: "Peach", hex: "#f3b18f" }
        ] : [] };
        currentProductState = { color: "", length: "Medium", form: "Almond", changes: "", quantity: 1 };

        setupUnifiedProductModal(currentProduct, true);
    }

    function setupUnifiedProductModal(product, isToe) {
        document.getElementById("productTitle").textContent = product.name;
        document.getElementById("productDescription").textContent = product.description;
        document.getElementById("productGelInfo").textContent = product.name === "French Toes"
            ? "Alla våra geler är starka, hållbara, köpta från Sverige och fria från skadliga kemikalier."
            : (product.gelInfo || "Naglarna är byggda med geleprodukter som är starka, hållbara och köpta från Sverige och EU. Gelén är fri från skadliga kemikalier.");
        const priceEl = document.getElementById("productPrice");
        if (priceEl) priceEl.textContent = `${Number(product.price || 0).toLocaleString("sv-SE")} kr`;
        document.getElementById("productQuantity").textContent = "1";
        renderProductGallery(product);

        const lengthChoice = document.getElementById("productLengthChoice");
        const formChoice = document.getElementById("productFormChoice");
        const sizeHeading = document.getElementById("productSizeHeading");
        const sizeHint = document.getElementById("productSizeHint");
        const labels = [
            ["productThumbLabel", isToe ? "Stortå" : "Tumme"],
            ["productIndexLabel", isToe ? "Tå 2" : "Pekfinger"],
            ["productMiddleLabel", isToe ? "Tå 3" : "Långfinger"],
            ["productRingLabel", isToe ? "Tå 4" : "Ringfinger"],
            ["productPinkyLabel", isToe ? "Lilltå" : "Lillfinger"]
        ];
        labels.forEach(([id, text]) => { document.getElementById(id).firstChild.textContent = text; });

        lengthChoice.style.display = isToe ? "block" : "none";
        if (formChoice) formChoice.style.display = isToe ? "none" : "block";
        sizeHeading.textContent = isToe ? "Välj storlek för varje tå" : "Välj storlek för varje finger";
        sizeHint.textContent = isToe ? "00 = störst · 13 = minst" : "00 = störst · 11 = minst";

        const formContainer = document.getElementById("productFormOptions");
        if (formContainer) {
            formContainer.innerHTML = `
                <button type="button" class="choice-button" data-form="Almond" onclick="selectProductForm(this)">Almond</button>
                <button type="button" class="choice-button" data-form="Coffin" onclick="selectProductForm(this)">Coffin</button>
                <button type="button" class="choice-button" data-form="Square" onclick="selectProductForm(this)">Square</button>
            `;
        }

        currentProductState.length = isToe ? "20 mm" : "Medium";
        currentProductState.form = isToe ? "Square" : "";
        currentProductState.changes = "";
        if (lengthChoice) lengthChoice.style.display = isToe ? "block" : "none";
        renderProductLengthOptions();
        const changesEl = document.getElementById("productChanges");
        if (changesEl) changesEl.value = "";
        const changesChoice = document.getElementById("productChangesChoice");
        const noSmallChanges = !isToe && ["Nude", "Pink French"].includes(product.name);
        if (changesChoice) changesChoice.style.display = (isToe || noSmallChanges) ? "none" : "block";

        const colorChoice = document.getElementById("productColorChoice");
        const colorContainer = document.getElementById("productColorOptions");
        const showColors = isToe && product.name === "French Toes";
        currentProductState.color = "";
        if (colorChoice) colorChoice.style.display = showColors ? "block" : "none";
        if (colorContainer) {
            colorContainer.innerHTML = showColors
                ? product.colors.map(c => `<button type="button" class="choice-button color-choice" data-color="${c.value}" onclick="selectProductColor(this)"><span class="color-dot" style="background:${c.hex}"></span>${c.name}</button>`).join("")
                : "";
        }

        if (isToe) {
            setupToeProductSizeSelectors();
        } else {
            setupProductSizeSelectors("Almond", "Medium");
        }

        document.getElementById("productModal").classList.add("active");
    }

    function renderProductLengthOptions() {
        const container = document.getElementById("productLengthOptions");
        if (!container) return;

        const isToe = currentProductType === "toes";
        const lengths = isToe
            ? ["20 mm", "18 mm", "16 mm"]
            : (currentProductState.form === "Almond"
                ? ["Medium", "Short"]
                : ["Medium", "Short", "ExtraShort", "XXShort"]);
        const mmLabels = { Medium: "25 mm", Short: "23 mm", ExtraShort: "20 mm", XXShort: "17 mm" };

        if (!lengths.includes(currentProductState.length)) currentProductState.length = lengths[0];
        container.innerHTML = lengths.map(length => {
            const label = length === "ExtraShort" ? "X Short" : length === "XXShort" ? "XX Short" : length;
            const detail = isToe ? "" : mmLabels[length];
            const selected = currentProductState.length === length ? " selected" : "";
            return `<button type="button" class="choice-button${selected}" data-length="${length}" onclick="selectProductLength(this)">${label}${detail ? `<small class="length-mm-note">${detail}</small>` : ""}</button>`;
        }).join("");
    }

    function setupToeProductSizeSelectors() {
        const ids = ["productThumbSize","productIndexSize","productMiddleSize","productRingSize","productPinkySize"];
        ids.forEach(id => {
            const select = document.getElementById(id);
            select.innerHTML = '<option value="">Välj</option>';
            ["00", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"].forEach(size => {
                const option = document.createElement("option");
                option.value = size;
                option.textContent = `Storlek ${size} – ${toeSizes[size]}`;
                select.appendChild(option);
            });
        });
    }

    function openProductDetailByName(name) {
        const product = getProductByName(name);
        if (product) openProductDetail(product.id);
    }

    function renderProductGallery(product) {
        const main = document.getElementById("productMainImage");
        const thumbs = document.getElementById("productThumbs");

        main.src = product.images[0];
        main.alt = product.name;
        thumbs.innerHTML = "";

        product.images.forEach((src, index) => {
            const thumb = document.createElement("button");
            thumb.type = "button";
            thumb.className = "gallery-thumb" + (index === 0 ? " active" : "");
            thumb.innerHTML = `<img src="${src}" alt="${product.name} bild ${index + 1}">`;

            const img = thumb.querySelector("img");
            img.onerror = () => {
                img.src = product.image;
            };

            thumb.onclick = () => {
                main.src = src;
                main.onerror = () => {
                    main.src = product.image;
                };
                thumbs.querySelectorAll(".gallery-thumb").forEach(item => item.classList.remove("active"));
                thumb.classList.add("active");
            };

            thumbs.appendChild(thumb);
        });

        main.onerror = () => {
            main.src = product.image;
        };
    }

    function setupProductSizeSelectors(form = "Almond", length = "Medium") {
        const ids = [
            "productThumbSize",
            "productIndexSize",
            "productMiddleSize",
            "productRingSize",
            "productPinkySize"
        ];

        const sizes = getNailSizeChart(form, length);

        ids.forEach(id => {
            const select = document.getElementById(id);
            if (!select) return;

            const previousValue = select.value;
            select.innerHTML = '<option value="">Välj</option>';

            Object.keys(sizes).forEach(size => {
                const option = document.createElement("option");
                option.value = size;
                option.textContent = `Storlek ${String(size) === "0" ? "00" : size} – ${sizes[size]}`;
                select.appendChild(option);
            });

            if (previousValue && sizes[previousValue]) select.value = previousValue;
        });
    }

    function selectProductForm(button) {
        if (currentProductType === "toes") return;
        currentProductState.form = button.dataset.form || "Almond";
        document.querySelectorAll("#productFormOptions .choice-button").forEach(item => item.classList.remove("selected"));
        button.classList.add("selected");
        const lengthChoice = document.getElementById("productLengthChoice");
        if (lengthChoice) lengthChoice.style.display = "block";
        renderProductLengthOptions();

        if (currentProductType === "toes") {
            setupToeProductSizeSelectors();
        } else {
            setupProductSizeSelectors(currentProductState.form, currentProductState.length);
        }
    }

    function selectProductColor(button) {
        currentProductState.color = button.dataset.color || "";
        document.querySelectorAll("#productColorOptions .choice-button").forEach(item => item.classList.remove("selected"));
        button.classList.add("selected");
    }

    function selectProductLength(button) {
        currentProductState.length = button.dataset.length || "Medium";
        document.querySelectorAll("#productLengthOptions .choice-button").forEach(item => item.classList.remove("selected"));
        button.classList.add("selected");

        if (currentProductType === "nails") {
            setupProductSizeSelectors(currentProductState.form, currentProductState.length);
        }
    }

    function changeProductQuantity(amount) {
        currentProductState.quantity = Math.max(
            1,
            Math.min(99, currentProductState.quantity + amount)
        );
        document.getElementById("productQuantity").textContent = currentProductState.quantity;
    }

    function getProductSizes() {
        return {
            thumb: document.getElementById("productThumbSize").value,
            index: document.getElementById("productIndexSize").value,
            middle: document.getElementById("productMiddleSize").value,
            ring: document.getElementById("productRingSize").value,
            pinky: document.getElementById("productPinkySize").value
        };
    }

    function productSizesComplete(sizes) {
        return Object.values(sizes).every(value => value !== "");
    }

    function addCurrentProductToCart() {
        if (!currentProduct) return;

        const sizes = getProductSizes();
        const changes = currentProductType === "toes" ? "" : (document.getElementById("productChanges")?.value.trim() || "");

        if (currentProductType === "toes" && currentProduct.name === "French Toes" && !currentProductState.color) {
            alert("Välj färg på french tår först ");
            return;
        }

        if (!currentProductState.length) {
            alert("Välj en längd först ");
            return;
        }

        if (currentProductType !== "toes" && !currentProductState.form) {
            alert("Välj en form först ");
            return;
        }

        if (!productSizesComplete(sizes)) {
            alert(currentProductType === "toes" ? "Välj en storlek för alla fem tår " : "Välj en storlek för alla fem fingrar ");
            return;
        }

        const item = {
            cartId: makeCartId(),
            type: currentProductType === "toes" ? "ready_toes" : "ready_nails",
            productId: currentProduct.id,
            name: currentProduct.name,
            image: currentProduct.image,
            color: currentProductState.color || "",
            length: currentProductState.length,
            sizes,
            quantity: currentProductState.quantity,
            customer: null,
            options: {
                design: currentProduct.name,
                length: currentProductState.length,
                ...(currentProductState.color ? { color: currentProductState.color } : {}),
                ...(currentProductType !== "toes" ? { form: currentProductState.form } : {}),
                sizes,
                changes,
                ...(currentProductType === "toes" ? { sizeMeasurements: Object.fromEntries(Object.entries(sizes).map(([k,v]) => [k, toeSizes[v] || ""])) } : {})
            },
            unitPrice: Number(currentProduct.price || 0)
        };

        cart.push(item);
        saveCart();
        closeModal("productModal");
        openCart();
    }

    // ---- Mer från PressN’Pop: Size Kit, Refresh, Refresh Redesign, Enstaka nagel ----
    // ÄNDRA PRISERNA HÄR (kr per st):
    const EXTRA_PRICES = { sizekit: 59, refresh: 149, redesign: 169, single: 59 };
    // Skydd som erbjuds innan totalen visas (kr, ett fast pris per beställning):
    const PROTECTION_PRICES = { size: 189, item: 99 };

    function extraPlaceholder(label) {
        return "data:image/svg+xml;utf8," + encodeURIComponent(
            "<svg xmlns='http://www.w3.org/2000/svg' width='600' height='530'><rect width='600' height='530' fill='#fbecef'/><text x='300' y='285' font-size='54' text-anchor='middle' fill='#b07a8c' font-family='Georgia,serif'>" +
            String(label).replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</text></svg>"
        );
    }

    const EXTRA_PRODUCTS = {
        sizekit: {
            name: "Size Kit", type: "extra_sizekit", mode: "kit",
            description: "Osäker på vilken storlek som passar? Med Size Kit testar du dig fram innan du beställer ett set.",
            more: "<strong>Vad är Size Kit?</strong>Välj ett kit för fingernaglar eller tånaglar. För fingernaglar får du prova storlekarna 0–11 i den form du väljer. För tår får du prova tåstorlekarna 00–13.<br><br><strong>Varför erbjuder vi det?</strong>Prova storlekarna hemma så att du vet vilka som passar innan du beställer ett set. Du behöver inte gissa eller mäta själv.<br><br><strong>Välj nedan</strong>Välj den form du vill prova, eller välj Tår om du vill hitta rätt storlekar för tånaglar. Size Kit har fri frakt."
        },
        refresh: {
            name: "Refresh", type: "extra_refresh", mode: "service",
            description: "Vi fräschar upp dina tidigare PressN’Pop-naglar så att du kan använda dem igen.",
            more: "<strong>Vad är Refresh?</strong>Vi fräschar upp dina tidigare PressN’Pop-naglar genom att rengöra bort limrester och fräscha upp glans och form. Du behåller alltså din befintliga design – du väljer ingen ny design med Refresh.<br><br><strong>Varför erbjuder vi det?</strong>Våra naglar är handgjorda och gjorda för att användas flera gånger. Med Refresh får dina favoriter ett längre liv – det är både billigare än ett nytt set och bättre för miljön.<br><br><strong>Så skickar du in dina naglar</strong>Du står själv för frakten när du skickar naglarna till oss. Lägg en liten lapp i paketet med ditt namn och telefonnummer så att vi kan hitta och koppla naglarna till rätt beställning.<br><br><strong>Bra att veta</strong>Gäller endast naglar som är köpta från PressN’Pop. Du lägger Refresh i varukorgen och betalar som vanligt, så hör vi av oss efter din beställning."
        },
        redesign: {
            name: "Refresh Redesign", type: "extra_redesign", mode: "service",
            description: "Vi fräschar upp dina tidigare PressN’Pop-naglar och du väljer en ny design från vår kollektion.",
            more: "<strong>Vad är Refresh Redesign?</strong>Refresh Redesign innebär att vi först fräschar upp dina tidigare PressN’Pop-naglar genom att rengöra bort limrester och fräscha upp glans och form. Därefter får du själv välja en ny design från vår kollektion. Basfärgen kan inte ändras. För tår erbjuds Original basfärg eller French.<br><br><strong>Varför erbjuder vi det?</strong>Är du less på en design men naglarna är hela? Istället för att köpa ett nytt set kan du ge de du redan har ett nytt liv. Det sparar pengar och är bättre för miljön.<br><br><strong>Så skickar du in dina naglar</strong>Du står själv för frakten när du skickar naglarna till oss. Lägg en liten lapp i paketet med ditt namn och telefonnummer så att vi kan hitta och koppla naglarna till rätt beställning.<br><br><strong>Bra att veta</strong>Gäller endast naglar som är köpta från PressN’Pop. Du lägger Redesign i varukorgen och betalar som vanligt, så hör vi av oss efter din beställning."
        },
        single: {
            name: "Enstaka nagel", type: "extra_single", mode: "single",
            description: "Har du tappat bort eller förstört en nagel? Välj design, form, längd och storlek precis som kollektionen.",
            more: "<strong>Ersättningsnagel</strong>Välj samma design som ditt set, samt form, längd, finger och storlek, så gör vi en nagel som matchar."
        }
    };

    let extraState = null;

    function initExtraCards() {
        document.querySelectorAll("[data-extra-price]").forEach(el => {
            const price = EXTRA_PRICES[el.dataset.extraPrice];
            if (price !== undefined) el.textContent = el.dataset.extraPrice === "redesign" ? `Från ${price.toLocaleString("sv-SE")} kr` : `${price.toLocaleString("sv-SE")} kr`;
        });
        document.querySelectorAll("[data-protection-price]").forEach(el => {
            const price = PROTECTION_PRICES[el.dataset.protectionPrice];
            if (price !== undefined) el.textContent = el.dataset.extraPrice === "redesign" ? `Från ${price.toLocaleString("sv-SE")} kr` : `${price.toLocaleString("sv-SE")} kr`;
        });
    }

    function openExtraDetail(kind) {
        const info = EXTRA_PRODUCTS[kind];
        if (!info) return;

        const extraModalBox = document.querySelector("#extraModal .product-modal-box");
        if (extraModalBox) {
            extraModalBox.classList.toggle("extra-compact", ["single", "refresh", "redesign"].includes(kind));
        }

        extraState = { kind, design: "", form: "", length: "", quantity: 1, redesignType: "nails", nailSelections: [{ finger: "", size: "" }] };

        document.getElementById("extraTitle").textContent = info.name;
        document.getElementById("extraPrice").textContent = `${kind === "redesign" ? "Från " : ""}${EXTRA_PRICES[kind].toLocaleString("sv-SE")} kr`;
        document.getElementById("extraDescription").textContent = info.description;
        document.getElementById("extraMoreInfo").innerHTML = info.more;
        document.getElementById("extraQuantity").textContent = "1";

        const show = (id, visible) => { const el = document.getElementById(id); if (el) el.style.display = visible ? "block" : "none"; };
        show("extraGallery", kind === "sizekit");
        show("extraDesignChoice", kind === "redesign");
        show("extraFormChoice", info.mode === "kit" || info.mode === "single");
        show("extraLengthChoice", false);
        show("extraSizeChoice", false);
        show("extraChangesChoice", info.mode === "single" || kind === "redesign");
        document.getElementById("extraChanges").value = "";

        const formOptions = info.mode === "kit"
            ? [["Almond Short", "Almond Short"], ["Almond Medium", "Almond Medium"], ["Coffin", "Coffin"], ["Square", "Square"], ["Tår", "Tår"]]
            : [["Almond", "Almond"], ["Coffin", "Coffin"], ["Square", "Square"], ["Tår", "Tår"]];
        document.getElementById("extraFormOptions").innerHTML = formOptions.map(([value, label]) =>
            `<button type="button" class="choice-button" data-form="${value}" onclick="selectExtraForm(this)">${value === "Tår" && document.documentElement.lang === "en" ? "Toes" : label}</button>`
        ).join("");

        if (info.mode === "single") {
            document.getElementById("extraDesignOptions").innerHTML = "";
            document.getElementById("extraLengthOptions").innerHTML = "";
            renderSingleNailSelections();
        } else if (kind === "redesign") {
            document.getElementById("extraDesignOptions").innerHTML =
                `
                 <div class="length-options">
                   <button type="button" class="choice-button selected" onclick="selectRedesignType(this,'nails')">Naglar – välj design ur kollektionen</button>
                   <button type="button" class="choice-button" onclick="selectRedesignType(this,'toes')">${document.documentElement.lang === "en" ? "Toes – Original Base Color or French" : "Tår – Original basfärg eller French"}</button>
                 </div>
                 <div id="redesignCollection" class="length-options" style="margin-top:12px"></div>
                 <p class="step-hint"><span style="font-size:12px;">Välj först naglar eller tår och sedan önskad design.</span> <span style="font-size:12px;">Priset är 20 kr lägre än motsvarande design i kollektionen.</span></p>`;
            renderRedesignCollection();
            document.getElementById("extraChanges").placeholder = "Små ändringar, t.ex. ta bort en liten detalj...";
        }

        document.getElementById("extraModal").classList.add("active");
    }

    function selectRedesignType(button, type) {
        extraState.redesignType = type;
        extraState.design = "";
        document.querySelectorAll("#extraDesignOptions > .length-options .choice-button").forEach(el => el.classList.remove("selected"));
        button.classList.add("selected");
        renderRedesignCollection();
    }

    function renderRedesignCollection() {
        const container = document.getElementById("redesignCollection");
        if (!container || !extraState || extraState.kind !== "redesign") return;
        const designs = extraState.redesignType === "toes"
            ? [{name:"Original basfärg", price:169}, {name:"French Toes", price:269}]
            : [{name:"Original basfärg", price:169}, ...readyProducts.filter(product => product.name !== "Nude").map(product => ({
                ...product,
                price: product.name === "Pink French" ? 269 : (product.name === "Pink Flower" ? 319 : 319)
            }))];
        container.innerHTML = designs.map(product => {
            const price = product.price;
            const displayName = product.name === "Original basfärg" && document.documentElement.lang === "en" ? "Original Base Color" : product.name;
            return `<button type="button" class="choice-button${extraState.design === product.name ? " selected" : ""}" data-design="${product.name}" data-price="${price}" onclick="selectExtraDesign(this)">${displayName}<small style="display:block;margin-top:5px">${price} kr</small></button>`;
        }).join("");
        updateRedesignPrice();
    }

    function selectExtraDesign(button) {
        extraState.design = button.dataset.design || "";
        document.querySelectorAll("#extraDesignOptions .choice-button").forEach(item => item.classList.remove("selected"));
        button.classList.add("selected");
        if (EXTRA_PRODUCTS[extraState.kind]?.mode === "single") {
            extraState.length = "";
            document.getElementById("extraLengthChoice").style.display = "block";
            document.getElementById("extraSizeChoice").style.display = "none";
            renderExtraLengthOptions();
        }
        updateRedesignPrice();
    }

    function updateRedesignPrice() {
        if (!extraState || extraState.kind !== "redesign") return;
        const selected = document.querySelector("#redesignCollection .choice-button.selected");
        const price = selected ? Number(selected.dataset.price || 0) : EXTRA_PRICES.redesign;
        document.getElementById("extraPrice").textContent = `${price.toLocaleString("sv-SE")} kr`;
    }

    function renderExtraLengthOptions() {
        const container = document.getElementById("extraLengthOptions");
        if (!container) return;
        const isToe = extraState.form === "Tår";
        const lengths = isToe ? ["20 mm", "18 mm", "16 mm"] : (extraState.form === "Almond" ? ["Medium", "Short"] : ["Medium", "Short", "ExtraShort", "XXShort"]);
        const mmLabels = { Medium: "25 mm", Short: "23 mm", ExtraShort: "20 mm", XXShort: "17 mm" };
        if (!lengths.includes(extraState.length)) extraState.length = "";
        container.innerHTML = lengths.map(length => {
            const label = length === "ExtraShort" ? "X Short" : length === "XXShort" ? "XX Short" : length;
            const note = isToe ? "" : mmLabels[length];
            const selected = extraState.length === length ? " selected" : "";
            return `<button type="button" class="choice-button${selected}" data-length="${length}" onclick="selectExtraLength(this)">${label}${note ? `<small class="length-mm-note">${note}</small>` : ""}</button>`;
        }).join("");
    }

    function selectExtraForm(button) {
        extraState.form = button.dataset.form || "";
        if (EXTRA_PRODUCTS[extraState.kind].mode === "single") {
            extraState.design = "";
            extraState.length = "";
            extraState.nailSelections.forEach(selection => { selection.size = ""; selection.finger = ""; });
        }
        document.querySelectorAll("#extraFormOptions .choice-button").forEach(item => item.classList.remove("selected"));
        button.classList.add("selected");
        if (EXTRA_PRODUCTS[extraState.kind].mode === "single") {
            const isToe = extraState.form === "Tår";
            const designs = isToe ? ["French Toes"] : ["Nude", "Pink French", "Pink Flower", "Nude Leo"];
            document.getElementById("extraDesignOptions").innerHTML = designs.map(name =>
                `<button type="button" class="choice-button" data-design="${name}" onclick="selectExtraDesign(this)">${name}</button>`
            ).join("");
            document.getElementById("extraDesignChoice").style.display = "block";
            document.getElementById("extraLengthChoice").style.display = "none";
            document.getElementById("extraSizeChoice").style.display = "none";
            document.getElementById("extraLengthOptions").innerHTML = "";
            updateExtraSizeOptions();
        }
    }

    function selectExtraLength(button) {
        extraState.length = button.dataset.length || "";
        document.querySelectorAll("#extraLengthOptions .choice-button").forEach(item => item.classList.remove("selected"));
        button.classList.add("selected");
        document.getElementById("extraSizeChoice").style.display = "block";
        updateExtraSizeOptions();
    }

    function renderSingleNailSelections() {
        const container = document.getElementById("singleNailSelections");
        if (!container || !extraState || EXTRA_PRODUCTS[extraState.kind].mode !== "single") return;
        if (!Array.isArray(extraState.nailSelections) || !extraState.nailSelections.length) {
            extraState.nailSelections = [{ finger: "", size: "" }];
        }
        const isToe = extraState.form === "Tår";
        const digits = isToe ? ["Stortå", "Tå 2", "Tå 3", "Tå 4", "Lilltå"] : ["Tumme", "Pekfinger", "Långfinger", "Ringfinger", "Lillfinger"];
        const sizes = isToe ? toeSizes : getNailSizeChart(extraState.form || "Almond", extraState.length || "Medium");
        const sizeKeys = Object.keys(sizes).sort((a, b) => {
            if (isToe && a === "00") return -1;
            if (isToe && b === "00") return 1;
            return Number(a) - Number(b);
        });
        container.innerHTML = extraState.nailSelections.map((selection, index) => `
            <div class="extra-finger-row single-nail-selection" style="margin-top:10px;align-items:end">
                <label>${isToe ? "Tå" : "Nagel"} ${index + 1} – ${isToe ? "vilken tå" : "finger"}
                    <select data-single-finger="${index}" onchange="updateSingleNailSelection(${index}, 'finger', this.value)">
                        <option value="">Välj ${isToe ? "tå" : "finger"}</option>
                        ${digits.map(digit => `<option value="${digit}" ${selection.finger === digit ? "selected" : ""}>${digit}</option>`).join("")}
                    </select>
                </label>
                <label>Storlek
                    <select data-single-size="${index}" onchange="updateSingleNailSelection(${index}, 'size', this.value)">
                        <option value="">Välj storlek</option>
                        ${sizeKeys.map(size => `<option value="${size}" ${String(selection.size) === String(size) ? "selected" : ""}>Storlek ${isToe ? size : (String(size) === "0" ? "00" : size)} – ${sizes[size]}</option>`).join("")}
                    </select>
                </label>
                ${index > 0 ? `<button type="button" class="choice-button" onclick="removeSingleNailSelection(${index})" style="grid-column:1/-1">Ta bort ${isToe ? "tå" : "nagel"}</button>` : ""}
            </div>
        `).join("");
    }

    function addSingleNailSelection() {
        if (!extraState || EXTRA_PRODUCTS[extraState.kind].mode !== "single") return;
        extraState.nailSelections.push({ finger: "", size: "" });
        renderSingleNailSelections();
    }

    function removeSingleNailSelection(index) {
        if (!extraState || EXTRA_PRODUCTS[extraState.kind].mode !== "single") return;
        if (extraState.nailSelections.length <= 1) return;
        extraState.nailSelections.splice(index, 1);
        renderSingleNailSelections();
    }

    function updateSingleNailSelection(index, field, value) {
        if (!extraState || EXTRA_PRODUCTS[extraState.kind].mode !== "single") return;
        if (!extraState.nailSelections[index]) return;
        extraState.nailSelections[index][field] = value;
    }

    function updateExtraSizeOptions() {
        if (!extraState || EXTRA_PRODUCTS[extraState.kind].mode !== "single") return;
        renderSingleNailSelections();
    }

    function changeExtraQuantity(amount) {
        if (!extraState) return;
        extraState.quantity = Math.max(1, Math.min(99, extraState.quantity + amount));
        document.getElementById("extraQuantity").textContent = extraState.quantity;
    }

    function addCurrentExtraToCart() {
        if (!extraState) return;
        const kind = extraState.kind;
        const info = EXTRA_PRODUCTS[kind];

        if ((info.mode === "single" || kind === "redesign") && !extraState.design) { alert("Välj en design först "); return; }
        if (info.mode !== "service" && !extraState.form) { alert("Välj en form först "); return; }
        if (info.mode === "single" && extraState.form !== "Tår" && !extraState.length) { alert("Välj en längd först "); return; }

        const options = {};
        let name = info.name;
        let lengthText = "";

        if (info.mode !== "service") options.form = extraState.form;
        if (kind === "sizekit" && extraState.form === "Tår") {
            options.form = "Tår (storlekar 00–13)";
            name = "Size Kit – Tår";
        }

        if (kind === "redesign") {
            options.design = extraState.design;
            options.designType = extraState.redesignType === "toes" ? "Tår" : "Naglar";
            const changes = (document.getElementById("extraChanges")?.value || "").trim();
            if (changes) options.changes = changes;
            name = `Refresh Redesign – ${options.designType}: ${extraState.design}`;
        }


        if (info.mode === "single") {
            if (!extraState.form) { alert("Välj en form först "); return; }
            if (!extraState.length) { alert("Välj en längd först "); return; }
            const changes = (document.getElementById("extraChanges")?.value || "").trim();
            for (let i = 0; i < extraState.nailSelections.length; i++) {
                const selection = extraState.nailSelections[i];
                if (!selection.finger) { alert(`Välj finger för nagel ${i + 1}.`); return; }
                if (selection.size === "") { alert(`Välj storlek för nagel ${i + 1}.`); return; }
            }
            extraState.nailSelections.forEach(selection => {
                const isToe = extraState.form === "Tår";
                const chart = isToe ? toeSizes : getNailSizeChart(extraState.form, extraState.length);
                const singleOptions = {
                    form: extraState.form,
                    length: extraState.length,
                    design: extraState.design,
                    finger: selection.finger,
                    ...(isToe ? { toe: selection.finger } : {}),
                    size: selection.size,
                    sizeMm: chart[selection.size] || ""
                };
                if (changes) singleOptions.changes = changes;
                const singleName = `Enstaka nagel – ${extraState.design}`;
                const singleSignature = JSON.stringify(singleOptions);
                const existingSingle = cart.find(item =>
                    item.type === info.type &&
                    item.name === singleName &&
                    (item.length || "") === extraState.length &&
                    JSON.stringify(item.options || {}) === singleSignature
                );
                if (existingSingle) {
                    existingSingle.quantity = Math.min(99, (Number(existingSingle.quantity) || 1) + 1);
                } else {
                    cart.push({
                        cartId: makeCartId(),
                        type: info.type,
                        name: singleName,
                        image: extraPlaceholder(info.name),
                        length: extraState.length,
                        quantity: 1,
                        customer: null,
                        options: singleOptions,
                        unitPrice: EXTRA_PRICES.single
                    });
                }
            });
            saveCart();
            closeModal("extraModal");
            openCart();
            return;
        }

        const signature = JSON.stringify(options);
        const existing = cart.find(item => item.type === info.type && item.name === name && (item.length || "") === lengthText && JSON.stringify(item.options || {}) === signature);

        if (existing) {
            existing.quantity = Math.min(99, (Number(existing.quantity) || 1) + extraState.quantity);
        } else {
            cart.push({
                cartId: makeCartId(),
                type: info.type,
                name,
                image: extraPlaceholder(info.name),
                length: lengthText,
                quantity: extraState.quantity,
                customer: null,
                options,
                unitPrice: kind === "redesign"
                    ? (document.querySelector("#redesignCollection .choice-button.selected")
                        ? Number(document.querySelector("#redesignCollection .choice-button.selected").dataset.price || EXTRA_PRICES.redesign)
                        : EXTRA_PRICES.redesign)
                    : EXTRA_PRICES[kind]
            });
        }

        saveCart();
        closeModal("extraModal");
        openCart();
    }

    function openExtraFromMenu(kind) {
        closeSiteDetailMenu();
        const section = document.getElementById("extra-tjanster");
        if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
        window.setTimeout(() => openExtraDetail(kind), 250);
    }

    function openMenuToe(name) {
        closeSiteDetailMenu();
        const section = document.getElementById("tar");
        if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
        window.setTimeout(() => openToeProductDetail(name), 250);
    }

    // ---- Skydd (storleksskydd / nagelskydd) ----
    const PROTECTION_INFO = {
        size: { type: "protection_size", name: "Storleksskydd", note: "Gäller ett set, används en gång. Max 2 storlekar byts = max 4 nya naglar, skickas gratis. Gäller i 4 månader efter köpet." },
        item: { type: "protection_item", name: "Nagelskydd", note: "Gäller ett set, används en gång. Ersätter max 2 naglar, skickas gratis. Gäller i 4 månader efter köpet." }
    };
    const PROTECTION_DETAILS = {
        size: {
            short: "Passar inte storleken? Vi gör nya.",
            points: [
                "Gäller ett (1) nagelset.",
                "Kan användas en gång.",
                "Passar max 2 av dina storlekar inte gör vi 2 nya storlekar – alltså max 4 nya naglar.",
                "Vi skickar de nya naglarna gratis.",
                "Gäller i 4 månader efter köpet.",
                "Flera set? Köp ett skydd per set."
            ]
        },
        item: {
            short: "Nagel bruten eller borta? Vi gör nya.",
            points: [
                "Gäller ett (1) nagelset.",
                "Kan användas en gång.",
                "Ersätter max 2 naglar som bryts, tappas bort eller förstörs.",
                "Vi gör nya naglar och skickar dem gratis.",
                "Gäller i 4 månader efter köpet.",
                "Flera set? Köp ett skydd per set."
            ]
        }
    };
    const protectionOpen = {};
    function toggleProtectionInfo(key) { protectionOpen[key] = !protectionOpen[key]; renderCartProtections(); }
    function isSetItem(item) {
        return ["ready_nails", "ready_toes", "custom_nails", "custom_toes"].includes(item && item.type);
    }

    function isProtectionItem(item) {
        return !!item && typeof item.type === "string" && item.type.startsWith("protection_");
    }

    function changeCartProtectionQuantity(key, delta) {
        const info = PROTECTION_INFO[key];
        if (!info) return;
        const existing = cart.find(item => item.type === info.type);
        const current = existing ? Math.max(0, Number(existing.quantity) || 0) : 0;
        const next = Math.max(0, Math.min(99, current + delta));
        if (next === 0) {
            cart = cart.filter(item => item.type !== info.type);
        } else if (existing) {
            existing.quantity = next;
        } else {
            cart.push({ cartId: makeCartId(), type: info.type, name: info.name, image: extraPlaceholder(info.name), quantity: next, customer: null, options: { note: info.note }, unitPrice: PROTECTION_PRICES[key] });
        }
        saveCart();
    }

    function renderCartProtections() {
        const box = document.getElementById("cartProtections");
        if (!box) return;
        if (!cart.some(isSetItem)) { box.innerHTML = ""; return; }
        const options = [["size", "Storleksskydd"], ["item", "Nagelskydd"]];
        box.innerHTML = `<div class="cart-protections">
            <h3>Skydd – valfritt</h3>
            <p class="protection-sub">Gäller ett nagelset. Lägg till, ta bort eller hoppa över.</p>
            <div class="protection-grid">
            ${options.map(([key, title]) => {
                const protectionItem = cart.find(item => item.type === PROTECTION_INFO[key].type);
                const quantity = protectionItem ? Math.max(0, Number(protectionItem.quantity) || 0) : 0;
                const added = quantity > 0;
                const d = PROTECTION_DETAILS[key];
                const open = !!protectionOpen[key];
                return `<div class="protection-option${added ? " selected" : ""}">
                    <div class="protection-option-top"><span>${title}</span><span>${PROTECTION_PRICES[key].toLocaleString("sv-SE")} kr</span></div>
                    <p class="protection-short">${d.short}</p>
                    <div class="protection-actions">
                        <div class="quantity-control protection-quantity"><button type="button" onclick="changeCartProtectionQuantity('${key}', -1)" aria-label="Ta bort ett skydd">−</button><span>${quantity}</span><button type="button" onclick="changeCartProtectionQuantity('${key}', 1)" aria-label="Lägg till ett skydd">+</button></div>
                        <button type="button" onclick="toggleProtectionInfo('${key}')" aria-expanded="${open}">${open ? "Visa mindre" : "Läs mer"}</button>
                    </div>
                    ${open ? `<div class="protection-more"><ul>${d.points.map(p => `<li>${p}</li>`).join("")}</ul></div>` : ""}
                </div>`;
            }).join("")}
            </div>
        </div>`;
    }

    function getCartItemUnitPrice(item) {
        if (!item) return 0;
        // Använd samma pris som visas på produkten, även för varukorgar som sparats tidigare.
        if (item.type === "custom_nails" || item.type === "custom_toes") return 399;
        if (item.type === "ready_nails") {
            const product = readyProducts.find(p => Number(p.id) === Number(item.productId) || p.name === item.name);
            if (product) return Number(product.price);
        }
        if (item.type === "ready_toes") {
            const product = readyToes.find(p => p.name === item.name);
            if (product) return Number(product.price);
        }
        if (item.type === "extra_sizekit") return EXTRA_PRICES.sizekit;
        if (item.type === "extra_refresh") return EXTRA_PRICES.refresh;
        if (item.type === "extra_redesign") {
            // Uppdatera även äldre varukorgar som sparat de tidigare redesignpriserna.
            const design = item.options?.design || "";
            if (design === "Original basfärg") return 169;
            if (design === "Pink French" || design === "French Toes") return 269;
            if (design) return 319;
            return EXTRA_PRICES.redesign;
        }
        if (item.type === "extra_single") return EXTRA_PRICES.single;
        if (item.type === "protection_size") return PROTECTION_PRICES.size;
        if (item.type === "protection_item") return PROTECTION_PRICES.item;
        return Number(item.unitPrice ?? item.price ?? 0);
    }

    function getCartSubtotal() {
        return cart.reduce((sum, item) => {
            return sum + getCartItemUnitPrice(item) * Math.max(1, Number(item.quantity) || 1);
        }, 0);
    }

    function countsTowardShipping(item) {
        // Size Kit har alltid fri frakt och ska aldrig påverka frakttrappan.
        // Kontrollera både produkttyp och namn så att även äldre varukorgar
        // med ett äldre/saknat type-värde hanteras korrekt.
        if (!item) return false;
        const type = String(item.type || "").trim().toLowerCase();
        const name = String(item.name || "").trim().toLowerCase();
        const isSizeKit = type === "extra_sizekit" ||
            type === "sizekit" ||
            name === "size kit" ||
            name.startsWith("size kit –") ||
            name.startsWith("size kit -");
        return !isSizeKit;
    }

    
function getShippingFee() {
    if (selectedDelivery !== "shipping") return 0;

    const shippingItems = cart.filter(countsTowardShipping);
    const count = shippingItems.reduce(
        (total, item) => total + Math.max(0, Number(item.quantity) || 0),
        0
    );

    if (count <= 0) return 0;

    // Egen frakttrappa för beställningar med enbart enstaka naglar.
    const onlySingleNails = shippingItems.every(
        item => String(item.type || "").trim().toLowerCase() === "extra_single"
    );

    if (onlySingleNails) {
        return Math.ceil(count / 10) * 22;
    }

    // Alla övriga beställningar behåller den gamla fraktberäkningen.
    if (count === 1) return 22;
    if (count <= 3) return 44;
    if (count <= 7) return 66;
    return 88;
}


    function selectDelivery(choice) {
        selectedDelivery = choice === "shipping" ? "shipping" : "pickup";
        localStorage.setItem("pnpDelivery", selectedDelivery);

        const pickupButton = document.getElementById("deliveryPickupButton");
        const shippingButton = document.getElementById("deliveryShippingButton");

        if (pickupButton) pickupButton.classList.toggle("selected", selectedDelivery === "pickup");
        if (shippingButton) shippingButton.classList.toggle("selected", selectedDelivery === "shipping");

        updateCartTotals();
        toggleDeliveryAddress();
    }

    function updateCartTotals() {
        const subtotal = getCartSubtotal();
        const shipping = getShippingFee();
        const total = subtotal + shipping;

        const subtotalEl = document.getElementById("cartSubtotal");
        const shippingEl = document.getElementById("cartShipping");
        const totalEl = document.getElementById("cartGrandTotal");

        if (subtotalEl) subtotalEl.textContent = `${subtotal.toLocaleString("sv-SE")} kr`;
        if (shippingEl) shippingEl.textContent = `${shipping.toLocaleString("sv-SE")} kr`;
        if (totalEl) totalEl.textContent = `${total.toLocaleString("sv-SE")} kr`;
    }

    function getCartItemDisplayName(item) {
        return item.name || "Produkt";
    }

    function updateCartUI() {
        const count = cart.filter(item => !isProtectionItem(item)).reduce((total, item) => total + Number(item.quantity || 0), 0);
        const countEl = document.getElementById("cartCount");
        const totalQuantityEl = document.getElementById("cartTotalQuantity");

        if (countEl) countEl.textContent = count;
        if (totalQuantityEl) totalQuantityEl.textContent = count;

        const container = document.getElementById("cartItems");
        const empty = document.getElementById("cartEmpty");
        const footer = document.getElementById("cartFooter");

        if (!container || !empty || !footer) return;

        if (!cart.length) {
            container.innerHTML = "";
            const protEmpty = document.getElementById("cartProtections");
            if (protEmpty) protEmpty.innerHTML = "";
            empty.style.display = "block";
            footer.style.display = "none";
            return;
        }

        empty.style.display = "none";
        footer.style.display = "block";

        container.innerHTML = cart.map(item => {
            const displayName = getCartItemDisplayName(item);
            const unitPrice = getCartItemUnitPrice(item);
            const itemTotal = unitPrice * Math.max(1, Number(item.quantity) || 1);
            const nailMeasurements = item.type === "ready_nails"
                ? getNailSizeChart(item.options?.form || "Almond", item.options?.length || item.length || "Medium")
                : null;

            const sizeDisplay = item.sizes
                ? ["thumb", "index", "middle", "ring", "pinky"]
                    .map(key => {
                        const value = item.sizes[key];
                        if (value === undefined || value === "") return "-";
                        const mm = nailMeasurements ? nailMeasurements[value] : (item.options?.sizeMeasurements?.[key] || "");
                        return mm ? `${value} (${mm})` : value;
                    })
                    .join("/")
                : "-";

            const optionText = [
                item.type === "ready_toes" && item.color ? `Färg: ${item.color}` : "",
                item.length ? `Längd: ${item.length}` : "",
                item.options?.form ? `Form: ${item.options.form}` : "",
                item.options?.finger ? `Finger: ${item.options.finger}` : "",
                (item.options?.finger && item.options?.size !== undefined && item.options.size !== "") ? `Storlek: ${item.options.size === "0" ? "00" : item.options.size}${item.options.sizeMm ? ` (${item.options.sizeMm})` : ""}` : "",
                item.options?.changes ? `${"Ändringar"}: ${item.options.changes}` : "",
                item.options?.note || ""
            ].filter(Boolean).join("<br>");

            return `
            <div class="cart-item">
                <img class="cart-item-image" src="${item.image}" alt="${displayName}">
                <div class="cart-item-info">
                    <h3>${displayName}</h3>
                    <p>${optionText}</p>
                    ${item.sizes ? `<p>Storlek: ${sizeDisplay}</p>` : ""}
                    <div class="cart-item-price">
                        <div><span class="cart-price-label">Pris/st:</span> ${unitPrice.toLocaleString("sv-SE")} kr</div>
                        <div><span class="cart-price-label">Summa:</span> <strong>${itemTotal.toLocaleString("sv-SE")} kr</strong></div>
                    </div>
                </div>
                <div class="cart-item-actions">
                    ${isProtectionItem(item) ? "" : `<button type="button" onclick="changeCartQuantity('${item.cartId}', -1)">−</button>
                    <strong>${item.quantity}</strong>
                    <button type="button" onclick="changeCartQuantity('${item.cartId}', 1)">+</button>`}
                    <button type="button" class="cart-remove" onclick="removeCartItem('${item.cartId}')">Ta bort</button>
                </div>
            </div>`;
        }).join("");

        renderCartProtections();
        updateCartTotals();
    }

    function openCart(skipOffer) {
        updateCartUI();
        document.getElementById("cartModal").classList.add("active");
    }

    function changeCartQuantity(cartId, amount) {
        const item = cart.find(product => product.cartId === cartId);
        if (!item) return;

        item.quantity = Math.max(0, Math.min(99, Number(item.quantity) + amount));

        if (item.quantity === 0) {
            cart = cart.filter(product => product.cartId !== cartId);
        }

        saveCart();
    }

    function removeCartItem(cartId) {
        cart = cart.filter(item => item.cartId !== cartId);
        saveCart();
    }

    document.querySelectorAll('.footer-logo').forEach(function(img){ var h=document.querySelector('.hero-logo img'); if(h) img.src=h.src; });


    // Visa sektioner och deras innehåll mjukt när besökaren scrollar.
    if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        document.documentElement.classList.add("scroll-reveal-enabled");
        const revealTargets = [];
        document.querySelectorAll("section:not(.hero)").forEach(section => {
            revealTargets.push(section);
            Array.from(section.children).forEach((child, index) => {
                child.classList.add("scroll-reveal-item");
                child.style.transitionDelay = `${Math.min(index * 90, 270)}ms`;
                revealTargets.push(child);
            });
        });
        const sectionObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("section-is-visible");
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.06, rootMargin: "0px 0px -45px 0px" });
        revealTargets.forEach(target => sectionObserver.observe(target));
    } else {
        document.querySelectorAll("section:not(.hero), .scroll-reveal-item").forEach(element => element.classList.add("section-is-visible"));
    }

    selectDelivery(selectedDelivery);
    initExtraCards();
    updateCartUI();


(function(){
 const input=document.getElementById('faqSearch'), clear=document.getElementById('clearFaqSearch');
 const status=document.getElementById('faqSearchStatus'), items=[...document.querySelectorAll('#faq .faq-item')];
 if(!input||!status)return;
 function filter(){
  const q=input.value.trim().toLocaleLowerCase('sv');let count=0;
  items.forEach(item=>{const match=!q||item.textContent.toLocaleLowerCase('sv').includes(q);item.hidden=!match;if(q&&match)item.open=true;if(match)count++;});
  clear.style.display=q?'block':'none';
  status.textContent=q?(count?`${count} svar matchar ”${input.value.trim()}”.`:`Inga svar hittades. Prova ett annat ord eller mejla pressnpop.uf@gmail.com.`):'Skriv ett sökord så visas relevanta svar direkt.';
 }
 input.addEventListener('input',filter);
 clear.addEventListener('click',()=>{input.value='';filter();input.focus();});
})();

(function(){
 const answerTranslations={"Öppna Naglar & Tår och tryck på den design du vill köpa. Välj form, längd och storlekar där alternativen finns och lägg produkten i varukorgen. När du har valt allt går du till kassan, fyller i dina kontaktuppgifter och skickar beställningen. Betalning sker via Swish enligt informationen i kassan. För Custom Nails eller Custom Toes laddar du upp en inspirationsbild och skriver vilka detaljer du vill ha. Om du vill ha flera olika custom-designer lägger du varje design som en separat produkt.": "Open Nails & Toes and select the design you want to buy. Choose the shape, length and sizes where available, then add the product to your cart. When you have made your selections, go to checkout, enter your contact details and submit your order. Payment is made via Swish as described at checkout. For Custom Nails or Custom Toes, upload an inspiration image and describe the details you would like. If you want several custom designs, add each design as a separate product.", "I ett set ingår nagelbandsputtare, alkoholpad, glue tabs, nagellim, nagelfil och instruktioner för applicering och skötsel. Börja med rena och torra naglar, skjut försiktigt tillbaka nagelbanden och matta vid behov den naturliga nagelytan lätt. Välj glue tabs eller nagellim enligt instruktionerna som följer med. Undvik vatten direkt efter applicering och bänd eller ryck inte loss naglarna när du tar av dem.": "Each set includes a cuticle pusher, alcohol pad, glue tabs, nail glue, nail file and application and care instructions. Start with clean, dry nails, gently push back the cuticles and lightly buff the natural nail surface if needed. Choose glue tabs or nail glue according to the included instructions. Avoid water immediately after application, and do not pry or pull the nails off when removing them.", "Mät varje naturlig nagel från sida till sida vid den bredaste punkten och jämför millimetermåttet med storleksguiden för den form du vill beställa. Mät varje finger separat eftersom storlekarna kan skilja sig åt. För tår använder du tåguiden. Är du osäker kan du beställa vårt Size Kit för 59 kr, där du kan prova storlekarna 0–11 i vald form. Size Kit har fri frakt.": "Measure each natural nail from side to side at its widest point and compare the measurement in millimetres with the size guide for your chosen shape. Measure each finger separately, as sizes may differ. Use the toe size guide for toes. If you are unsure, you can order our Size Kit for SEK 59 to try sizes 0–11 in your chosen shape. The Size Kit includes free shipping.", "Alla set görs för hand, så tillverkningstiden kan variera beroende på design och hur många beställningar vi har. I kassan ser du fraktkostnaden innan du skickar beställningen. Du kan välja frakt eller upphämtning om det alternativet visas. Vi kontaktar dig om det behövs mer information kring din beställning eller leverans.": "All sets are handmade, so production time may vary depending on the design and the number of orders we have. You will see the shipping cost at checkout before submitting your order. You can choose shipping or collection if that option is shown. We will contact you if we need more information about your order or delivery.", "Kontakta oss så snart som möjligt på pressnpop.uf@gmail.com om du behöver ändra något. När tillverkningen har börjat kan vi inte alltid ändra beställningen. Våra press-on gelénaglar kan återanvändas om du tar av dem försiktigt, rengör dem och förvarar dem säkert. Hur länge de sitter beror bland annat på förberedelser, fästmetod och hur du sköter dem. Undvik att använda naglarna som verktyg och var försiktig med starka kemikalier.": "Contact us as soon as possible at pressnpop.uf@gmail.com if you need to make a change. Once production has started, we may not be able to change the order. Our press-on gel nails can be reused if you remove them carefully, clean them and store them safely. How long they stay on depends on preparation, the attachment method and how you care for them. Avoid using the nails as tools and be careful around strong chemicals.", "Ta av naglarna försiktigt, rengör bort limrester och förvara dem i asken när du inte använder dem. Om en nagel försvinner eller skadas kan du beställa en ersättningsnagel under Enstaka Nagel. Du kan också fräscha upp naglarna själv hemma eller låta oss göra det genom vår Refresh-tjänst. Om naglarna har blivit slitna eller om du har tröttnat på designen kan du välja Refresh Redesign, där vi fräschar upp naglarna och du får välja en ny design från vår kollektion.": "Remove the nails carefully, clean off any glue residue and store them in their case when not in use. If a nail is lost or damaged, you can order a replacement under Single Nail. You can also refresh the nails at home or let us do it through our Refresh service. If the nails have become worn or you want a different look, choose Refresh Redesign: we refresh the nails and you can select a new design from our collection.", "Glue tabs är självhäftande fästkuddar som passar när du vill kunna ta av naglarna enklare och ofta använda dem under kortare tid. Nagellim ger vanligtvis ett starkare och mer långvarigt fäste. Följ alltid instruktionerna som följer med setet och avbryt användningen om du får irritation.": "Glue tabs are adhesive pads that make the nails easier to remove and are often suitable for shorter wear. Nail glue usually provides a stronger, longer-lasting hold. Always follow the instructions included with your set and stop using the product if irritation occurs.", "Ja, naglarna kan återanvändas om de tas av varsamt och inte skadas. Rengör försiktigt bort limrester och förvara dem i asken. Hur många gånger de kan användas beror på hur de appliceras, tas av och sköts.": "Yes. The nails can be reused if they are removed carefully and are not damaged. Gently clean off glue residue and store them in their case. The number of times they can be reused depends on how they are applied, removed and cared for.", "För bästa hållbarhet bör du undvika vatten direkt efter applicering. Långvarig kontakt med varmt vatten kan påverka fästet, så var försiktig vid dusch, bad och disk.": "For the best hold, avoid water immediately after application. Prolonged contact with hot water may affect the adhesive, so take care when showering, bathing or washing dishes.", "Mät naglarna vid den bredaste punkten och jämför måtten med storleksguiden. Om du fortfarande är osäker kan du beställa ett Size Kit för att prova storlekarna innan du beställer ett helt set.": "Measure your nails at their widest point and compare the measurements with the size guide. If you are still unsure, you can order a Size Kit to try the sizes before ordering a full set.", "Ja, välj Custom Nails eller Custom Toes och beskriv dina önskemål. Du kan ladda upp en inspirationsbild och skriva vilka färger, detaljer eller förändringar du önskar. Varje separat custom-design läggs som en egen produkt i varukorgen.": "Yes. Choose Custom Nails or Custom Toes and describe what you have in mind. You can upload an inspiration image and specify the colours, details or changes you would like. Add each separate custom design to your cart as its own product."};

 const translations={
 'Hem':'Home','Kollektion':'Collection','Om oss':'About us','Beställ':'Order','Varukorg':'Cart',
 'Utforska PressN’Pop':'Explore PressN’Pop','Hitta din favorit eller hoppa direkt till en del av sidan.':'Find your favourite or jump to a section of the page.',
 'Så funkar det':'How it works','Det här ingår i nagelset':'What is included in a nail set','Alla naglar':'All nails','Se alla naglar':'View all nails',
 'Tådesigner':'Toe designs','Se alla tådesigner':'View all toe designs','Franska tår':'French toes','Mer från PressN’Pop':'More from PressN’Pop',
 'Storlekskit – hitta rätt storlek':'Sizing kit – find your size','Enstaka nagel':'Single nail','Uppfräschning':'Refresh','Ny design':'New design',
 'Storlekar & hjälp':'Sizing & help','Storleksguide för naglar':'Nail size guide','Storleksguide för tår':'Toe size guide',
 'Vanliga frågor':'Frequently asked questions','Så beställer du':'How to order','Kontakt':'Contact',
 'Frågor & Svar':'Questions & Answers','F&S':'Q&A','Sök bland frågor och svar':'Search questions and answers',
 'Skriv ett sökord så visas relevanta svar direkt.':'Type a keyword to see relevant answers instantly.',
 'Hur beställer jag, och hur fungerar Custom?':'How do I order, and how does Custom work?',
 'Vad ingår i ett set och hur applicerar jag naglarna?':'What is included in a set and how do I apply the nails?',
 'Hur väljer jag rätt storlek för fingrar och tår?':'How do I choose the right size for fingers and toes?',
 'Hur lång tid tar frakten och när får jag min beställning?':'How long does shipping take and when will I receive my order?',
 'Kan jag ändra beställningen och hur länge håller naglarna?':'Can I change my order and how long do the nails last?',
 'Hur kan jag förlänga livslängden på mina press-on naglar?':'How can I extend the life of my press-on nails?',
 'Vad är skillnaden mellan glue tabs och nagellim?':'What is the difference between glue tabs and nail glue?',
 'Kan jag använda press-on naglar flera gånger?':'Can I reuse press-on nails?',
 'Kan jag duscha eller bada med press-on naglar?':'Can I shower or bathe while wearing press-on nails?',
 'Vad gör jag om jag inte vet vilken storlek jag ska välja?':'What if I do not know which size to choose?',
 'Kan jag få en helt egen färg eller design?':'Can I get a completely custom colour or design?',
 'Information':'Information','Integritet & Villkor':'Privacy & Terms','Integritetspolicy':'Privacy Policy',
 'Köp & Beställning':'Purchases & Orders','Retur & Reklamation':'Returns & Complaints','Säkerhet & Skötsel':'Safety & Care',
 'Handgjorda press-on naglar från Eskilstuna':'Handmade press-on nails from Eskilstuna',
 'Betala via Swish först och skicka sedan in din beställning.':'Pay via Swish first, then submit your order.',
 'Tillbaka':'Back','Nästa':'Next','Lägg i varukorg':'Add to cart','Fortsätt':'Continue','Avbryt':'Cancel','Stäng':'Close',
 'Välj längd':'Choose length','Välj form':'Choose shape','Välj storlek':'Choose size','Färg':'Colour','Längd':'Length',
 'Storlek':'Size','Form':'Shape','Ändringar':'Changes','Ta bort':'Remove'
 };
Object.assign(translations,answerTranslations);
 const textNodes=[];
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 while(walker.nextNode()){const n=walker.currentNode;if(n.nodeValue.trim())textNodes.push({node:n,sv:n.nodeValue});}
 const attrs=[];
 document.querySelectorAll('[placeholder]').forEach(el=>attrs.push({el,sv:el.getAttribute('placeholder')}));
 function apply(lang){
  const en=lang==='en';
  textNodes.forEach(({node,sv})=>{const key=sv.trim();if(!en)node.nodeValue=sv;else if(translations[key])node.nodeValue=sv.replace(key,translations[key]);});
  const placeholderEnglish = {
    faqSearch: 'Search e.g. size, shipping or nail glue...',
    cartCheckoutFirstName: 'Your first name',
    cartCheckoutLastName: 'Your last name',
    cartCheckoutPhone: '07XXXXXXXXX',
    cartCheckoutEmail: 'you@email.com',
    cartCheckoutAddress: 'Example Street 12',
    cartCheckoutPostal: '123 45',
    cartCheckoutCity: 'e.g. Stockholm',
    cartCheckoutMessage: 'E.g. if you need your order by a specific date...',
    orderMessage: 'E.g. if you need your nails by a specific date...'
  };
  attrs.forEach(({el,sv})=>{
    const english = placeholderEnglish[el.id] || ({
      'productChanges':'E.g. silver instead of gold, remove a detail...',
      'extraChanges':'E.g. silver instead of gold, remove a detail...',
      'customNailChanges':'E.g. change the colour to pink, remove the stones or add glitter...',
      'customToeChanges':'E.g. change the colour, remove details or add glitter...'
    }[el.id]);
    el.setAttribute('placeholder', en ? (english || sv) : sv);
  });
  document.documentElement.lang=en?'en':'sv';
  document.querySelectorAll('.language-option').forEach(b=>{const active=b.dataset.lang===lang;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active?'true':'false');});
  const label=document.querySelector('label[for="faqSearch"]');if(label)label.textContent=en?'Search questions and answers':'Sök bland frågor och svar';
  const hint=document.getElementById('faqSearchStatus');if(hint&&!inputValue())hint.textContent=en?'Type a keyword to see relevant answers instantly.':'Skriv ett sökord så visas relevanta svar direkt.';
 }
 function inputValue(){return document.getElementById('faqSearch')?.value||'';}
 document.querySelectorAll('.language-option').forEach(b=>b.addEventListener('click',()=>apply(b.dataset.lang)));
 apply('sv');
})();



/* Complete English language layer: translates existing and dynamically-created interface text. */
(function () {
  const dictionary = {"PressN’Pop UF":"PressN’Pop UF",
"3. Välj storlek för varje tå":"3. Choose a size for each toe",
"Välj storlek för varje tå":"Choose a size for each toe",
"Välj en storlek för varje tå. Måtten visas enligt tåstorlekarna.":"Choose a size for each toe. Measurements are shown according to the toe size guide.",
"Stortå":"Big toe","Lilltå":"Little toe","Tå 2":"Toe 2","Tå 3":"Toe 3","Tå 4":"Toe 4",
"Välj":"Choose","Din custom-design":"Your custom design",
"Basfärg:":"Base colour:","Inte vald":"Not selected","Form:":"Shape:","Längd:":"Length:",
"Storlekar:":"Sizes:","Inspo-bild:":"Inspiration image:","Ingen bild vald":"No image selected",
"Ändringar:":"Changes:","Inga särskilda ändringar angivna":"No specific changes requested",
"Inspo-bild":"Inspiration image",
"Ladda upp din inspirationsbild. Vi komprimerar den automatiskt och visar storleken efter komprimering här nedanför. Dina uppladdade inspo-bilder får tillsammans vara högst 9 MB.":"Upload your inspiration image. We’ll compress it automatically and show the file size after compression below. Your uploaded inspiration images can have a combined size of up to 9 MB.",
"Välj fil":"Choose file","Ingen fil har valts":"No file chosen",
"Förnamn *":"First name *","Efternamn *":"Last name *",
"Telefonnummer som du använder vid Swish-betalningen *":"Phone number used for your Swish payment *",
"Skriv samma nummer som är kopplat till den Swish-betalning du kommer att göra.":"Enter the same number linked to the Swish payment you are about to make.",
"E-post *":"Email *","Adress *":"Address *","Gatuadress":"Street address",
"Postnummer *":"Postal code *","Ort *":"City *","Meddelande / övrigt":"Message / other",
"T.ex. när du behöver beställningen...":"E.g. when you need your order...",
"Ditt förnamn":"", "Ditt efternamn":"",
"T.ex. silver istället för guld, ta bort detalj...":"E.g. silver instead of gold, remove a detail...",
"Små ändringar, t.ex. ta bort en liten detalj...":"Small changes, e.g. remove a small detail...",
"T.ex. byt färg till rosa, ta bort stenarna, lägg till glitter...":"E.g. change the colour to pink, remove the stones or add glitter...",
"T.ex. byt färg, ta bort detaljer eller lägg till glitter...":"E.g. change the colour, remove details or add glitter...",
"T.ex. när du behöver beställningen...":"E.g. when you need your order...",
"T.ex. när du behöver naglarna...":"E.g. when you need your nails...",
"din@email.se":"name@example.com",
"Gatuadress":"Street name and number","123 45":"12345","Eskilstuna":"e.g. Stockholm",
"din@email.se":"you@email.com",
"Enstaka nagel":"Single Nail","Enstaka Nagel":"Single Nail","Visa produkt":"View product",
"Fyll i uppgifterna en gång. Vi använder förnamn, efternamn och telefonnummer exakt som du anger dem för att kunna matcha beställningen med din Swish-betalning.":"Enter your details once. We use your first name, last name and phone number exactly as provided to match your order with your Swish payment.",
"Så fungerar beställningen":"How the order works",
"Betala först via Swish till 1237052459. När du har betalat trycker på ”Skicka beställning”. Beställningen skickas till PressN’Pop UF och kontrolleras av oss.":"First, pay via Swish to 1237052459. Once you have paid, click “Submit order”. Your order will be sent to PressN’Pop UF and checked by our team.",
"Hem":"Home","Kollektion":"Collection","Om oss":"About us","Beställ":"Order","Varukorg":"Cart","Öppna varukorg":"Open cart","Öppna varukorgen":"Open cart","Välj språk":"Choose language","Utforska PressN’Pop":"Explore PressN’Pop","Hitta din favorit eller hoppa direkt till en del av sidan.":"Find your favourite or jump straight to a section of the page.","⌂ Hem":"⌂ Home","Så funkar det":"How it works","Det här ingår i nagelset":"What’s included in a nail set","Alla naglar":"All nails","Se alla naglar":"View all nails","Tådesigner":"Toe designs","Se alla tådesigner":"View all toe designs","Franska tår":"French toes","Mer från PressN’Pop":"More from PressN’Pop","Storlekskit – hitta rätt storlek":"Size Kit – find your size","Enstaka nagel":"Single Nail","Uppfräschning":"Refresh","Ny design":"New design","Custom – skapa egna naglar":"Custom – create your own nails","Custom – skapa egna tår":"Custom – create your own toes","Storlekar & hjälp":"Sizing & help","Storleksguide för naglar":"Nail size guide","Storleksguide för tår":"Toe size guide","Vanliga frågor":"Frequently asked questions","Så beställer du":"How to order","✉ Kontakt":"✉ Contact","Ge dina naglar det lilla extra med handgjorda press-on gelénaglar. Varje set skapas med omsorg och låter dig bära din favoritdesign när du vill. Välj bland våra kollektioner eller skapa ett set helt efter dina önskemål – enkla att applicera, ta av och bära igen.":"Give your nails something special with handmade press-on gel nails. Each set is carefully crafted, letting you wear your favourite design whenever you like. Choose from our collections or create a set tailored to your wishes – easy to apply, remove and wear again.","Köp kollektion":"Shop the collection","Designa eget":"Create your own","Enkelt att hitta rätt":"Easy to find your fit","Din nagelresa":"Your nail journey","Hitta din design":"Find your design","Utforska vår färdiga kollektion, eller välj custom om du vill skapa något eget.":"Explore our ready-made collection, or choose custom if you want to create something of your own.","Se kollektion":"View collection","Hitta rätt passform":"Find the right fit","Använd storleksguiden och läs informationen på produktsidan för att välja alternativ som passar dig.":"Use the size guide and read the product page information to choose the options that suit you.","Se storleksguiden":"View the size guide","Gör den personlig":"Make it personal","Vill du ändra detaljer eller skicka en egen idé? Välj custom och berätta vad du önskar.":"Would you like to change any details or share your own idea? Choose custom and tell us what you have in mind.","Se custom":"Explore custom","Vår kollektion":"Our collection","Naglar & Tår":"Nails & Toes","Enfärgad nude nyans":"Solid nude shade","Klassisk vit french":"Classic white French tip","3D-blomma, guldpärlor och swirls":"3D flower, gold beads and swirls","Leopard, 3D-swirl och guldpärlor":"Leopard print, 3D swirl and gold beads","Klassisk vit french med val av basfärg. Välj mellan Light Pink, Pink, Nude eller Peach.":"Classic white French tips with your choice of base colour. Choose Light Pink, Pink, Nude or Peach.","Visa produkt":"View product","Skrolla åt sidan för fler designs":"Scroll sideways to see more designs","Skrolla åt sidan för fler produkter":"Scroll sideways to see more products","Hittar du inte en design som känns helt rätt? Då kan du skapa ditt eget set för 399 kr.":"Can’t find a design that feels just right? You can create your own set for SEK 399.","Välj basfärg, form, längd och storlek och skicka sedan en inspo-bild så att vi förstår din idé.":"Choose a base colour, shape, length and size, then send us an inspiration photo so we can understand your idea.","Börja skapa naglar":"Start creating your nails","Har du en egen idé till dina tår? Skicka en inspo-bild och berätta hur du vill att vi ska anpassa designen.":"Have your own idea for your toes? Send an inspiration photo and tell us how you’d like us to customise the design.","Välj basfärg och storlek, och skicka sedan en inspo-bild så att vi kan skapa ditt eget tå-set.":"Choose a base colour and size, then send us an inspiration photo so we can create your own toe set.","Börja skapa tår":"Start creating your toes","Storleksguide":"Size Guide","Mät din naturliga nagel från sida till sida på den bredaste punkten för att hitta rätt storlek. Måtten anges i mm och är ungefärliga. Längden väljer du separat nedan.":"Measure your natural nail from side to side at its widest point to find the right size. Measurements are approximate and shown in mm. Choose your length separately below.","Välj din perfekta längd":"Choose your perfect length","Nagellängden mäts på tummen från nagelbandet till tippen. Övriga naglar anpassas proportionerligt.":"Nail length is measured on the thumb, from the cuticle to the tip. The other nails are scaled proportionally.","För tår:":"For toes:","välj mellan 20 mm, 18 mm eller 16 mm. Måttet avser stortån – de övriga tårna anpassas proportionerligt.":"choose between 20 mm, 18 mm or 16 mm. The measurement refers to the big toe – the other toes are scaled proportionally.","Samma mått gäller för alla längder.":"The same measurements apply to all lengths.","Storlek":"Size ","Bredd":"Width","00 = störst · 11 = minst":"00 = largest · 11 = smallest","00 = störst · 13 = minst":"00 = largest · 13 = smallest","Bredd på Almond Medium-tippar.":"Width of Almond Medium tips.","Bredd på Almond Short-tippar.":"Width of Almond Short tips.","Bredd på tåtippar. Samma mått gäller för alla längder.":"Width of toe tips. The same measurements apply to all lengths.","Små detaljer, stor skillnad":"Small details make a big difference","Det här ingår":"What’s included","Alla set innehåller tillbehör som hjälper dig att förbereda, applicera och ta hand om dina press-on naglar.":"Every set includes accessories to help you prepare, apply and care for your press-on nails.","N agelbandsputtare":"Cuticle pusher","Nagelbandsputtare":"Cuticle pusher","Putta försiktigt tillbaka nagelbanden innan du förbereder nageln.":"Gently push back your cuticles before preparing the nail.","Nagelfil":"Nail file","Fila försiktigt över den naturliga nagelytan för att förbereda den.":"Gently buff the surface of your natural nail to prepare it.","Alkoholpad":"Alcohol pad","Rengör nagelytan och låt den torka innan du fäster lösnageln.":"Clean the nail surface and let it dry before applying the press-on nail.","Glue tabs & Nagellim":"Glue tabs & nail glue","Välj ett av fästalternativen och pressa på naglarna.":"Choose one of the adhesive options and press on the nails.","Instruktioner":"Instructions","Läs instruktionerna för applicering och skötsel innan du börjar.":"Read the application and care instructions before you begin.","Informationen gäller både nagelset och tåset.":"This information applies to both nail and toe sets.","Vi är tre tjejer från Eskilstuna – Iliana, Limar och Matilda – som lärde känna varandra under vår första tid på gymnasiet.":"We are three friends from Eskilstuna – Iliana, Limar and Matilda – who met during our first year of upper secondary school.","Idén bakom PressN’Pop växte fram när Iliana, som länge hade gjort naglar på sig själv och sina vänner, började på ett jobb där hon inte fick ha naglar. Det fick oss att börja fundera: Varför ska man behöva kompromissa mellan snygga naglar och vardagens krav?":"The idea behind PressN’Pop came about when Iliana, who had been doing her own nails and her friends’ nails for a long time, started a job where she wasn’t allowed to wear nails. It made us wonder: why should you have to compromise between beautiful nails and the demands of everyday life?","Vi ville skapa ett alternativ som kombinerar salongskänsla med enkelhet. Naglar som är hållbara och snygga, men som också är enkla att applicera, ta av och återanvända. Perfekt när man vill känna sig extra fin, även med kort varsel!":"We wanted to create an alternative that combines a salon-quality look with simplicity. Nails that are durable and beautiful, but also easy to apply, remove and reuse. Perfect when you want to feel extra special, even at short notice!","Och det var så PressN’Pop föddes – med en idé om att göra fina naglar mer tillgängliga och flexibla för alla.":"And that’s how PressN’Pop was born – with the idea of making beautiful nails more accessible and flexible for everyone.","Foto på oss kommer snart":"Photo of us coming soon","Tre kompisar, en idé och väldigt många nageldesigner som väntar på att skapas.":"Three friends, one idea and so many nail designs waiting to be created.","Redo för dina nya naglar?":"Ready for your new nails?","Välj en färdig design eller skapa ett helt eget set. Vi gör resten.":"Choose a ready-made design or create a set of your own. We’ll take care of the rest.","Beställ dina naglar":"Order your nails","Skapa custom nails":"Create custom nails","Skapa custom toes":"Create custom toes","Håll dig uppdaterad":"Stay updated","Följ Oss":"Follow us","E-post:":"Email:","Frågor & Svar":"Questions & Answers","F&S":"Q&A","Sök bland frågor och svar":"Search questions and answers","Skriv ett sökord så visas relevanta svar direkt.":"Enter a keyword to see relevant answers instantly.","Hur beställer jag, och hur fungerar Custom?":"How do I order, and how does Custom work?","Vad ingår i ett set och hur applicerar jag naglarna?":"What is included in a set and how do I apply the nails?","Hur väljer jag rätt storlek för fingrar och tår?":"How do I choose the right size for fingers and toes?","Hur lång tid tar frakten och när får jag min beställning?":"How long does shipping take and when will I receive my order?","Kan jag ändra beställningen och hur länge håller naglarna?":"Can I change my order, and how long do the nails last?","Hur kan jag förlänga livslängden på mina press-on naglar?":"How can I extend the life of my press-on nails?","Vad är skillnaden mellan glue tabs och nagellim?":"What is the difference between glue tabs and nail glue?","Kan jag använda press-on naglar flera gånger?":"Can I reuse press-on nails?","Kan jag duscha eller bada med press-on naglar?":"Can I shower or bathe while wearing press-on nails?","Vad gör jag om jag inte vet vilken storlek jag ska välja?":"What should I do if I don’t know which size to choose?","Kan jag få en helt egen färg eller design?":"Can I get a completely custom colour or design?","Öppna Naglar & Tår och tryck på den design du vill köpa. Välj form, längd och storlekar där alternativen finns och lägg produkten i varukorgen. När du har valt allt går du till kassan, fyller i dina kontaktuppgifter och skickar beställningen. Betalning sker via Swish enligt informationen i kassan. För Custom Nails eller Custom Toes laddar du upp en inspirationsbild och skriver vilka detaljer du vill ha. Om du vill ha flera olika custom-designer lägger du varje design som en separat produkt.":"Open Nails & Toes and select the design you want to buy. Choose the shape, length and sizes where available, then add the product to your cart. Once you’ve made your selections, go to checkout, enter your contact details and submit your order. Payment is made via Swish as described at checkout. For Custom Nails or Custom Toes, upload an inspiration photo and describe the details you would like. If you want several different custom designs, add each design as a separate product.","I ett set ingår nagelbandsputtare, alkoholpad, glue tabs, nagellim, nagelfil och instruktioner för applicering och skötsel. Börja med rena och torra naglar, skjut försiktigt tillbaka nagelbanden och matta vid behov den naturliga nagelytan lätt. Välj glue tabs eller nagellim enligt instruktionerna som följer med. Undvik vatten direkt efter applicering och bänd eller ryck inte loss naglarna när du tar av dem.":"Each set includes a cuticle pusher, alcohol pad, glue tabs, nail glue, nail file and application and care instructions. Start with clean, dry nails, gently push back your cuticles and lightly buff the natural nail surface if needed. Choose glue tabs or nail glue according to the included instructions. Avoid water immediately after application, and do not pry or pull the nails off when removing them.","Mät varje naturlig nagel från sida till sida vid den bredaste punkten och jämför millimetermåttet med storleksguiden för den form du vill beställa. Mät varje finger separat eftersom storlekarna kan skilja sig åt. För tår använder du tåguiden. Är du osäker kan du beställa vårt Size Kit för 59 kr, där du kan prova storlekarna 0–11 i vald form. Size Kit har fri frakt.":"Measure each natural nail from side to side at its widest point and compare the measurement in millimetres with the size guide for your chosen shape. Measure each finger separately, as sizes may differ. Use the toe size guide for toes. If you’re unsure, you can order our Size Kit for SEK 59 to try sizes 0–11 in your chosen shape. The Size Kit includes free shipping.","Alla set görs för hand, så tillverkningstiden kan variera beroende på design och hur många beställningar vi har. I kassan ser du fraktkostnaden innan du skickar beställningen. Du kan välja frakt eller upphämtning om det alternativet visas. Vi kontaktar dig om det behövs mer information kring din beställning eller leverans.":"All sets are handmade, so production time may vary depending on the design and the number of orders we have. You’ll see the shipping cost at checkout before submitting your order. You can choose shipping or collection if that option is available. We’ll contact you if we need more information about your order or delivery.","Kontakta oss så snart som möjligt på pressnpop.uf@gmail.com om du behöver ändra något. När tillverkningen har börjat kan vi inte alltid ändra beställningen. Våra press-on gelénaglar kan återanvändas om du tar av dem försiktigt, rengör dem och förvarar dem säkert. Hur länge de sitter beror bland annat på förberedelser, fästmetod och hur du sköter dem. Undvik att använda naglarna som verktyg och var försiktig med starka kemikalier.":"Contact us as soon as possible at pressnpop.uf@gmail.com if you need to make a change. Once production has started, we may not be able to change the order. Our press-on gel nails can be reused if you remove them carefully, clean them and store them safely. How long they stay on depends on preparation, the adhesive method and how you care for them. Avoid using the nails as tools and be careful around strong chemicals.","Ta av naglarna försiktigt, rengör bort limrester och förvara dem i asken när du inte använder dem. Om en nagel försvinner eller skadas kan du beställa en ersättningsnagel under Enstaka Nagel. Du kan också fräscha upp naglarna själv hemma eller låta oss göra det genom vår Refresh-tjänst. Om naglarna har blivit slitna eller om du har tröttnat på designen kan du välja Refresh Redesign, där vi fräschar upp naglarna och du får välja en ny design från vår kollektion.":"Remove the nails carefully, clean off any glue residue and store them in their case when you’re not using them. If a nail is lost or damaged, you can order a replacement under Single Nail. You can also refresh the nails at home or let us do it through our Refresh service. If the nails have become worn or you’re ready for a new look, choose Refresh Redesign: we’ll refresh the nails and you can choose a new design from our collection.","Glue tabs är självhäftande fästkuddar som passar när du vill kunna ta av naglarna enklare och ofta använda dem under kortare tid. Nagellim ger vanligtvis ett starkare och mer långvarigt fäste. Följ alltid instruktionerna som följer med setet och avbryt användningen om du får irritation.":"Glue tabs are self-adhesive tabs that make the nails easier to remove and are often suitable for shorter wear. Nail glue usually provides a stronger, longer-lasting hold. Always follow the instructions included with your set and stop using the product if irritation occurs.","Ja, naglarna kan återanvändas om de tas av varsamt och inte skadas. Rengör försiktigt bort limrester och förvara dem i asken. Hur många gånger de kan användas beror på hur de appliceras, tas av och sköts.":"Yes. The nails can be reused if they are removed carefully and are not damaged. Gently clean off any glue residue and store them in their case. How many times they can be reused depends on how they are applied, removed and cared for.","För bästa hållbarhet bör du undvika vatten direkt efter applicering. Långvarig kontakt med varmt vatten kan påverka fästet, så var försiktig vid dusch, bad och disk.":"For the best hold, avoid water immediately after application. Prolonged contact with hot water may affect the adhesive, so take care when showering, bathing or washing dishes.","Mät naglarna vid den bredaste punkten och jämför måtten med storleksguiden. Om du fortfarande är osäker kan du beställa ett Size Kit för att prova storlekarna innan du beställer ett helt set.":"Measure your nails at their widest point and compare the measurements with the size guide. If you’re still unsure, you can order a Size Kit to try the sizes before ordering a full set.","Ja, välj Custom Nails eller Custom Toes och beskriv dina önskemål. Du kan ladda upp en inspirationsbild och skriva vilka färger, detaljer eller förändringar du önskar. Varje separat custom-design läggs som en egen produkt i varukorgen.":"Yes. Choose Custom Nails or Custom Toes and describe what you have in mind. You can upload an inspiration photo and specify the colours, details or changes you would like. Add each separate custom design to your cart as its own product.","Information":"Information","Integritet & Villkor":"Privacy & Terms","Integritetspolicy":"Privacy Policy","När du skickar en beställning behöver vi använda de kontaktuppgifter du lämnar, till exempel namn, telefonnummer, e-postadress och eventuell leveransadress, för att kunna hantera din beställning och kontakta dig.":"When you submit an order, we need to use the contact details you provide, such as your name, phone number, email address and any delivery address, to process your order and contact you.","Vi använder uppgifterna endast för att hantera din beställning och den kontakt som behövs kring den.":"We use this information only to process your order and for any necessary communication about it.","Köp & Beställning":"Purchases & Orders","Kontrollera att dina uppgifter, storlekar och önskemål är korrekta innan du skickar beställningen. Därefter betalar du via Swish. Vi kontrollerar betalningen och bekräftar sedan din beställning. Använd samma telefonnummer vid Swish som du angav i beställningen, så att vi enkelt kan matcha betalningen med rätt order.":"Please check that your details, sizes and requests are correct before submitting your order. Then pay via Swish. We’ll verify the payment and confirm your order. Use the same phone number for Swish as the one you entered with your order, so we can easily match the payment to the correct order.","Retur & Reklamation":"Returns & Complaints","Eftersom våra naglar är specialanpassade efter kundens storlekar och önskemål gäller ingen ångerrätt.":"As our nails are customised to each customer’s sizes and preferences, the right of withdrawal does not apply.","Om du upptäcker ett fel på din beställning eller om något inte stämmer, kontakta oss så snart som möjligt på pressnpop.uf@gmail.com och beskriv problemet.":"If you notice an error with your order or something is not right, contact us as soon as possible at pressnpop.uf@gmail.com and describe the issue.","Ange gärna ditt namn, beställningsuppgifter och bilder på det som är fel så att vi kan hjälpa dig vidare.":"Please include your name, order details and photos of the issue so we can help you.","Säkerhet & Skötsel":"Safety & Care","Använd naglarna enligt instruktionerna som följer med ditt set. Var försiktig vid applicering och använd inte naglarna som verktyg. Om du upplever irritation eller obehag ska du ta bort naglarna. När du tar av dem, rengör dem försiktigt från limrester och förvara dem i sin ask så att de håller sig fina och kan återanvändas.":"Use the nails according to the instructions included with your set. Be careful when applying them and do not use the nails as tools. If you experience irritation or discomfort, remove the nails. When removing them, gently clean off any glue residue and store them in their case so they stay in good condition and can be reused.","Handgjorda press-on naglar från Eskilstuna":"Handmade press-on nails from Eskilstuna","Betala via Swish först och skicka sedan in din beställning.":"Pay via Swish first, then submit your order.","© 2026 PressN'Pop UF":"© 2026 PressN'Pop UF","Produkt":"Product","Produktbeskrivning":"Product description","Om gelén":"About the gel","I varje nagel- och tåset ingår:":"Every nail and toe set includes:","nagelbandsputtare, Alkoholpad, glue tabs, nagellim, nagelfil samt en lapp med instruktioner för applicering och skötsel av dina press-on naglar.":"a cuticle pusher, alcohol pad, glue tabs, nail glue, nail file and an instruction card for applying and caring for your press-on nails.","Välj färg på french tår":"Choose a colour for French toes","Välj form":"Choose shape","Välj längd":"Choose length","Välj storlek för varje finger":"Choose a size for each finger","0 = störst · 11 = minst":"0 = largest · 11 = smallest","Tumme":"Thumb","Pekfinger":"Index finger","Långfinger":"Middle finger","Ringfinger":"Ring finger","Lillfinger":"Pinky","Små ändringar":"Small changes","Vi gör vårt bästa för att genomföra dina önskemål, men kan inte garantera att alla ändringar blir möjliga.":"We’ll do our best to accommodate your requests, but we can’t guarantee that every change will be possible.","Lägg i varukorg":"Add to cart","Tillbaka":"Back","Skrolla åt höger för fler bilder →":"Scroll right to see more images →","Välj design":"Choose design","Välj finger och storlek":"Choose finger and size","Välj finger och storlek för varje nagel. Tryck på ”Lägg till nagel” om du vill beställa fler naglar från samma set.":"Choose a finger and size for each nail. Press “Add nail” if you want to order more nails from the same set.","+ Lägg till nagel":"+ Add nail","Din varukorg":"Your cart","Kontrollera dina produkter innan du går vidare till betalning.":"Review your products before proceeding to payment.","Hur vill du få din beställning?":"How would you like to receive your order?","Hämta upp":"Collection","Gratis":"Free","Frakt":"Shipping","Från 22 kr":"From SEK 22","Nagelbandsputtare · Alkoholpad · Glue tabs · Nagellim · Nagelfil · Lapp med instruktioner för applicering och skötsel":"Cuticle pusher · Alcohol pad · Glue tabs · Nail glue · Nail file · Application and care instruction card","Varukorgen är tom":"Your cart is empty","Välj en design och lägg den i varukorgen.":"Choose a design and add it to your cart.","Antal produkter":"Number of products","Varor":"Items","Totalt":"Total","Fler set ger högre frakt: 1 set 22 kr · 2–3 set 44 kr · 4–7 set 66 kr · 8 eller fler 88 kr.":"Shipping increases with more sets: 1 set SEK 22 · 2–3 sets SEK 44 · 4–7 sets SEK 66 · 8 or more SEK 88.","Betala med Swish":"Pay with Swish","Tryck på knappen för att öppna Swish på mobilen eller visa en QR-kod på datorn. Kontrollera alltid mottagaren och beloppet innan du godkänner betalningen.":"Press the button to open Swish on your phone or display a QR code on your computer. Always check the recipient and amount before approving the payment.","Öppna Swish / visa QR-kod":"Open Swish / show QR code","Swish Företag:":"Swish Business:","Belopp att betala:":"Amount to pay:","Om beloppet inte fylls i automatiskt anger du totalsumman manuellt i Swish. Skriv gärna ditt namn som meddelande.":"If the amount is not filled in automatically, enter the total manually in Swish. You can include your name as the payment message.","Kopiera Swish-nummer":"Copy Swish number","Fortsätt shoppa":"Continue shopping","Gå till betalning":"Proceed to payment","Slutför din beställning":"Complete your order","Fyll i uppgifterna en gång. Vi använder förnamn, efternamn och telefonnummer exakt som du anger dem för att kunna matcha beställningen med din Swish-betalning.":"Fill in your details once. We use your first name, last name and phone number exactly as entered to match your order with your Swish payment.","Förnamn *":"First name *","Efternamn *":"Last name *","Telefonnummer som du använder vid Swish-betalningen *":"Phone number used for the Swish payment *","Skriv samma nummer som är kopplat till den Swish-betalning du kommer att göra.":"Enter the same number linked to the Swish payment you are going to make.","E-post *":"Email *","Adress *":"Address *","Postnummer *":"Postal code *","Ort *":"City *","Meddelande / övrigt":"Message / additional information","Så fungerar beställningen":"How the order works","Betala först via Swish till 1237052459. När du har betalat trycker på ”Skicka beställning”. Beställningen skickas till PressN’Pop UF och kontrolleras av oss.":"First, pay via Swish to 1237052459. Once you have paid, press “Submit order”. Your order will be sent to PressN’Pop UF and checked by us.","Skicka beställning →":"Submit order →","Välj dina alternativ och lägg produkten i varukorgen.":"Choose your options and add the product to your cart.","STEG 1":"STEP 1","STEG 2 STORLEK":"STEP 2 – SIZE","STEG 2":"STEP 2","STEG 3":"STEP 3","STEG 4 INSPO":"STEP 4 – INSPIRATION","STEG 5 ÄNDRINGAR":"STEP 5 – CHANGES","STEG 6 UPPGIFTER":"STEP 6 – DETAILS","Vilken design vill du ha?":"Which design would you like?","Välj dina storlekar":"Choose your sizes","Storlek 0 är störst och 11 är minst.":"Size 0 is the largest and 11 is the smallest.","Välj en storlek för varje finger. Måtten beror på nagelformen.":"Choose a size for each finger. Measurements depend on the nail shape.","Välj":"Choose","Dina uppgifter":"Your details","Antal":"Quantity","Tack för din beställning!":"Thank you for your order!","Din beställning är förberedd. Vi återkommer till dig så snart som möjligt.":"Your order has been prepared. We’ll get back to you as soon as possible.","Klar":"Done","Välj design och storlek för alla fem tår.":"Choose a design and size for all five toes.","Vilken tådesign vill du ha?":"Which toe design would you like?","Välj basfärg":"Choose base colour","Välj storlek":"Choose size","Måtten för tår är preliminära och kan uppdateras senare.":"Toe measurements are preliminary and may be updated later.","Stortå":"Big toe","Tå 2":"Toe 2","Tå 3":"Toe 3","Tå 4":"Toe 4","Lilltå":"Little toe","Bygg ditt eget set steg för steg.":"Build your own set step by step.","STEG 1 BASFÄRG":"STEP 1 – BASE COLOUR","1. Välj basfärg":"1. Choose a base colour","STEG 1 FORM":"STEP 1 – SHAPE","2. Välj form":"2. Choose a shape","STEG 2 LÄNGD":"STEP 2 – LENGTH","3. Välj längd":"3. Choose a length","STEG 3 STORLEK":"STEP 3 – SIZE","4. Välj dina storlekar":"4. Choose your sizes","0 är störst · 11 är minst":"0 is the largest · 11 is the smallest","Välj en storlek för varje finger. Måtten visas enligt den form du valde.":"Choose a size for each finger. Measurements are shown according to the shape you selected.","5. Visa oss din idé":"5. Show us your idea","Inspo-bild":"Inspiration photo","Ladda upp din inspirationsbild. Vi komprimerar den automatiskt och visar storleken efter komprimering här nedanför. Dina uppladdade inspo-bilder får tillsammans vara högst 9 MB.":"Upload your inspiration photo. We’ll automatically compress it and show the compressed file size below. Your uploaded inspiration photos may total no more than 9 MB.","6. Vill du ändra något?":"6. Would you like to change anything?","Ändringar från inspo-bilden":"Changes to the inspiration photo","7. Dina uppgifter":"7. Your details","Din idé är skickad!":"Your idea has been submitted!","Vi kollar igenom din custom-idé och återkommer till dig så snart vi kan.":"We’ll review your custom idea and get back to you as soon as we can.","Skapa ditt eget tå-set steg för steg.":"Create your own toe set step by step.","2. Välj längd":"2. Choose a length","3. Välj storlek för varje tå":"3. Choose a size for each toe","00 är störst · 13 är minst":"00 is the largest · 13 is the smallest","Välj en storlek för varje tå. Måtten visas enligt tåstorlekarna.":"Choose a size for each toe. Measurements are based on the toe size chart.","4. Visa oss din idé":"4. Show us your idea","5. Vill du ändra något?":"5. Would you like to change anything?","6. Dina uppgifter":"6. Your details","Pris/st:":"Price/item:","Summa:":"Subtotal:","Ta bort":"Remove","Färg:":"Colour:","Längd:":"Length:","Form:":"Shape:","Finger:":"Finger:","Ändringar:":"Changes:","Från":"From","Vit":"White","Röd":"Red","Rosa":"Pink","Mörkröd":"Dark red","Lavendel":"Lavender","Original rosa":"Original pink","Original röd":"Original red","Original rosa/guld":"Original pink/gold","Baby pink":"Baby pink","Nude":"Nude","Peach":"Peach","Medium":"Medium","Short":"Short","X Short":"X Short","XX Short":"XX Short","Almond":"Almond","Square":"Square","Coffin":"Coffin","French":"French","French Toes":"French Toes","Toes":"Toes","Light Pink":"Light Pink","Pink":"Pink","White":"White","Osäker på vilken storlek som passar? Med Size Kit testar du dig fram innan du beställer ett set.":"Not sure which size fits? Try the Size Kit before ordering a set.","Vi fräschar upp dina tidigare PressN’Pop-naglar så att du kan använda dem igen.":"We refresh your previous PressN’Pop nails so you can use them again.","Vi fräschar upp dina tidigare PressN’Pop-naglar och du väljer en ny design från vår kollektion.":"We refresh your previous PressN’Pop nails, and you choose a new design from our collection.","Har du tappat bort eller förstört en nagel? Välj design, form, längd och storlek precis som kollektionen.":"Lost or damaged a nail? Choose the design, shape, length and size just as you would from the collection.","Vad är Size Kit?":"What is the Size Kit?","Välj ett kit för fingernaglar eller tånaglar. För fingernaglar får du prova storlekarna 0–11 i den form du väljer. För tår får du prova tåstorlekarna 00–13.":"Choose a kit for fingernails or toenails. For fingernails, you can try sizes 0–11 in your chosen shape. For toes, you can try toe sizes 00–13.","Varför erbjuder vi det?":"Why do we offer it?","Prova storlekarna hemma så att du vet vilka som passar innan du beställer ett set. Du behöver inte gissa eller mäta själv.":"Try the sizes at home so you know which ones fit before ordering a set. No need to guess or measure yourself.","Välj nedan":"Choose below","Välj den form du vill prova, eller välj Tår om du vill hitta rätt storlekar för tånaglar. Size Kit har fri frakt.":"Choose the shape you want to try, or select Toes to find the right sizes for toenails. The Size Kit includes free shipping.","Vad är Refresh?":"What is Refresh?","Vi fräschar upp dina tidigare PressN’Pop-naglar genom att rengöra bort limrester och fräscha upp glans och form. Du behåller alltså din befintliga design – du väljer ingen ny design med Refresh.":"We refresh your previous PressN’Pop nails by removing glue residue and restoring their shine and shape. You keep your existing design – Refresh does not include a new design.","Så skickar du in dina naglar":"How to send us your nails","Du står själv för frakten när du skickar naglarna till oss. Lägg en liten lapp i paketet med ditt namn och telefonnummer så att vi kan hitta och koppla naglarna till rätt beställning.":"You are responsible for the shipping cost when sending your nails to us. Include a small note with your name and phone number so we can match the nails to the correct order.","Bra att veta":"Good to know","Gäller endast naglar som är köpta från PressN’Pop. Du lägger Refresh i varukorgen och betalar som vanligt, så hör vi av oss efter din beställning.":"Only applies to nails purchased from PressN’Pop. Add Refresh to your cart and pay as usual; we’ll contact you after you place your order.","Vad är Refresh Redesign?":"What is Refresh Redesign?","Refresh Redesign innebär att vi först fräschar upp dina tidigare PressN’Pop-naglar genom att rengöra bort limrester och fräscha upp glans och form. Därefter får du själv välja en ny design från vår kollektion. Basfärgen kan inte ändras. För tår erbjuds Original basfärg eller French.":"Refresh Redesign means we first refresh your previous PressN’Pop nails by removing glue residue and restoring their shine and shape. You then choose a new design from our collection. The base colour cannot be changed. For toes, Original base colour or French is available.","Är du less på en design men naglarna är hela? Istället för att köpa ett nytt set kan du ge de du redan har ett nytt liv. Det sparar pengar och är bättre för miljön.":"Ready for a change but your nails are still in good condition? Instead of buying a new set, give the ones you already have a new life. It saves money and is better for the environment.","Gäller endast naglar som är köpta från PressN’Pop. Du lägger Redesign i varukorgen och betalar som vanligt, så hör vi av oss efter din beställning.":"Only applies to nails purchased from PressN’Pop. Add Redesign to your cart and pay as usual; we’ll contact you after you place your order.","Ersättningsnagel":"Replacement nail","Välj samma design som ditt set, samt form, längd, finger och storlek, så gör vi en nagel som matchar.":"Choose the same design as your set, along with the shape, length, finger and size, and we’ll make a matching nail.","Pris/st":"Price/item","Summa":"Subtotal","Pris":"Price","Storlekar":"Sizes","Storlek:":"Size:","Välj färg":"Choose colour","Färg":"Colour","Ändringar":"Changes","Ange":"Enter","Sök":"Search","Rensa":"Clear","Inga svar hittades. Prova ett annat ord eller mejla pressnpop.uf@gmail.com.":"No answers found. Try another keyword or email pressnpop.uf@gmail.com.","svar matchar":" answers match ","Skriv ett sökord, t.ex. storlek, frakt eller lim...":"Enter a keyword, e.g. size, shipping or glue...","🛒 Öppna varukorgen":"🛒 Open cart","Ta hand om dina set, hitta rätt storlek eller ersätt en nagel som saknas.":"Care for your sets, find the right size or replace a missing nail.","Testa tippar i storlek 0–11 och hitta rätt storlek innan du beställer ett set. Fri frakt.":"Try nail tips in sizes 0–11 and find your fit before ordering a set. Free shipping.","Har du tappat eller förstört en nagel? Beställ en enstaka ersättning.":"Lost or damaged a nail? Order a single replacement.","Vi fräschar upp dina naglar och du väljer en ny design från vår kollektion.":"We refresh your nails, and you choose a new design from our collection.","Fler set ger högre frakt":"Shipping increases with more sets","Naglar – välj design ur kollektionen":"Nails – choose a design from the collection","Tår – Original basfärg eller French":"Toes – Original base colour or French","Välj först naglar eller tår och sedan önskad design.":"First choose nails or toes, then choose your preferred design.","Priset är 20 kr lägre än motsvarande design i kollektionen.":"The price is SEK 20 lower than the equivalent design in the collection.","Välj en färg först":"Choose a colour first ","Välj en tådesign först":"Choose a toe design first","Välj en design först":"Choose a design first ","Välj en basfärg först":"Choose a base colour first ","Välj en nagelform först":"Choose a nail shape first ","Inte vald":"Not selected","Inga särskilda ändringar angivna":"No specific changes requested","Basfärg:":"Base colour:","Tådesign:":"Toe design:","vilken tå":"which toe","finger":"finger","nagel":"nail","Välj tå":"Choose toe","Välj finger":"Choose finger","Visa mindre":"Show less","Läs mer":"Read more","Gäller ett nagelset. Lägg till, ta bort eller hoppa över.":"Applies to one nail set. Add it, remove it or skip it.","Små ändringar, t.ex. ta bort en liten detalj...":"Small changes, e.g. removing a small detail...","Din beställning":"Your order","Din custom-tådesign":"Your custom toe design","Fortsätt":"Continue","Avbryt":"Cancel","Stäng":"Close","Nästa →":"Next →","← Tillbaka":"← Back","French Toes har en klassisk french-design. Välj basfärg mellan Light Pink, Pink, Nude eller Peach för att anpassa uttrycket.":"French Toes features a classic French design. Choose a base colour from Light Pink, Pink, Nude or Peach to customise the look.","Alla våra geler är starka, hållbara, köpta från Sverige och fria från skadliga kemikalier.":"All our gels are strong, durable, sourced from Sweden and free from harmful chemicals.","Nude är ett klassiskt enfärgat set i en mjuk nude nyans för en ren, naturlig och minimalistisk look.":"Nude is a classic solid-colour set in a soft nude shade for a clean, natural and minimalist look.","Naglarna är byggda med gelén DUNE från Chewali som är en nude nyans. Alla våra geler är starka, hållbara, köpta från Sverige och fria från skadliga kemikalier.":"The nails are made with DUNE gel by Chewali, a nude shade. All our gels are strong, durable, sourced from Sweden and free from harmful chemicals.","Pink French är en klassisk vit fransk manikyr för en ren, fräsch och tidlös look som passar till alla tillfällen.":"Pink French is a classic white French manicure for a clean, fresh and timeless look suitable for every occasion.","Naglarna är byggda med gelén FANCY PINK från Missfancy som är en rosa nyans. Alla våra geler är starka, hållbara, köpta från Sverige och fria från skadliga kemikalier.":"The nails are made with FANCY PINK gel by Missfancy, a pink shade. All our gels are strong, durable, sourced from Sweden and free from harmful chemicals.","Pink Flower har 3D-blomma, guldpärlor och 3D-swirls för en lekfull och detaljrik look som verkligen märks.":"Pink Flower features a 3D flower, gold beads and 3D swirls for a playful, detailed look that stands out.","Nude Leo har leopardmönster, lite 3D-swirl och guldpärlor för en piffig och uttrycksfull look med mycket personlighet.":"Nude Leo features a leopard print, a touch of 3D swirl and gold beads for a bold, expressive look full of personality.","Basfärg":"Base colour","Välj en storlek för alla fem fingrar först.":"Choose a size for all five fingers first.","Välj en storlek för alla fem tår först.":"Choose a size for all five toes first.","Våra naglar är handgjorda och gjorda för att användas flera gånger. Med Refresh får dina favoriter ett längre liv – det är både billigare än ett nytt set och bättre för miljön.":"Our nails are handmade and designed to be used more than once. Refresh gives your favourites a longer life – it costs less than a new set and is better for the environment.","Endast naglar som är köpta från PressN’Pop.":"Only applies to nails purchased from PressN’Pop.","Select bland våra kollektioner eller skapa ett set helt efter dina önskemål – enkla att applicera, ta av och bära igen.":"Choose from our collections or create a set tailored to your wishes – easy to apply, remove and wear again.","nageldesigner":"nail designs","Skriv ett ord, t.ex. storlek, frakt eller lim...":"Enter a word, e.g. size, shipping or glue...","T.ex. silver istället för guld, ta bort detalj...":"E.g. silver instead of gold, remove a detail...","Ditt förnamn":"Your first name","Ditt efternamn":"Your last name","0701234567":"0701234567","din@email.se":"you@email.com","Gatuadress":"Street address","123 45":"123 45","Eskilstuna":"Eskilstuna","T.ex. när du behöver beställningen...":"E.g. when you need the order...","T.ex. när du behöver naglarna...":"E.g. when you need the nails...","T.ex. byt färg till rosa, ta bort stenarna, lägg till glitter...":"E.g. change the colour to pink, remove the stones, add glitter...","T.ex. byt färg, ta bort detaljer eller lägg till glitter...":"E.g. change the colour, remove details or add glitter...","Öppna detaljerad meny":"Open detailed menu","Plats reserverad för ett framtida foto på grundarna":"Placeholder for a future photo of the founders","Rensa sökning":"Clear search","Minska antal":"Decrease quantity","Öka antal":"Increase quantity","Nude naglar":"Nude nails","Nude naglar – bild 2":"Nude nails – image 2","Pink French naglar":"Pink French nails","Pink French naglar – bild 2":"Pink French nails – image 2","Pink Flower naglar":"Pink Flower nails","Pink Flower naglar – bild 2":"Pink Flower nails – image 2","Nude Leo naglar":"Nude Leo nails","Nude Leo naglar – bild 2":"Nude Leo nails – image 2","French Toes – bild 2":"French Toes – image 2","Custom nageldesign":"Custom nail design","Custom tådesign":"Custom toe design","QR-kod för att öppna Swish-betalning":"QR code to open Swish payment","Välj ett ord, t.ex. storlek, frakt eller lim...":"Enter a word, e.g. size, shipping or glue...","Välj en storlek för alla fem fingrar":"Choose a size for all five fingers ","Välj en storlek för alla fem tår":"Choose a size for all five toes ","Varje mejl måste innehålla exakt en inspo-bild.":"Each email must contain exactly one inspiration photo.","Välj en storlek för varje finger":"Choose a size for each finger","Välj en storlek för varje tå":"Choose a size for each toe","Fler set ger högre frakt:":"Shipping increases with more sets:","Original":"Original","Skydd – valfritt":"Protection – optional","Storleksskydd":"Size Protection","Nagelskydd":"Nail Protection","Passar inte storleken? Vi gör nya.":"Doesn't fit? We'll make replacements.","Nagel bruten eller borta? Vi gör nya.":"Nail broken or missing? We'll make a replacement.","Gäller ett (1) nagelset.":"Applies to one (1) nail set.","Kan användas en gång.":"Can be used once.","Passar max 2 av dina storlekar inte gör vi 2 nya storlekar – alltså max 4 nya naglar.":"If up to 2 sizes don't fit, we'll make 2 replacement sizes – up to 4 new nails in total.","Vi skickar de nya naglarna gratis.":"We'll ship the replacement nails free of charge.","Gäller i 4 månader efter köpet.":"Valid for 4 months after purchase.","Flera set? Köp ett skydd per set.":"Ordering multiple sets? Add one protection per set.","Ersätter max 2 naglar som bryts, tappas bort eller förstörs.":"Covers up to 2 nails that break, get lost or are damaged.","Vi gör nya naglar och skickar dem gratis.":"We'll make replacement nails and ship them free of charge.","Ta bort ett skydd":"Remove one protection","Lägg till ett skydd":"Add one protection"};
  const originalText = new WeakMap();
  const lastEnglishText = new WeakMap();
  const originalAttrs = new WeakMap();
  const lastEnglishAttrs = new WeakMap();
  let currentLanguage = 'sv';

  const attrNames = ['placeholder', 'aria-label', 'title', 'alt'];
  const exact = (value) => {
    const trimmed = value.trim();
    const normalized = trimmed.replace(/\s+/g, ' ');
    if (Object.prototype.hasOwnProperty.call(dictionary, normalized)) {
      return value.replace(trimmed, dictionary[normalized]);
    }
    // Translate known Swedish labels embedded in generated cart and status strings.
    let result = value;
    const phrases = Object.keys(dictionary).filter(k => k.length > 2).sort((a,b) => b.length-a.length);
    for (const phrase of phrases) {
      if (phrase === normalized) continue;
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp('(^|[^\\p{L}\\p{N}])' + escaped + '(?=$|[^\\p{L}\\p{N}])', 'gu');
      result = result.replace(pattern, (match, prefix) => prefix + dictionary[phrase]);
    }
    return result;
  };

  // Native validation alerts are outside the DOM, so translate them explicitly
  // using the currently selected language.
  const nativeAlert = window.alert.bind(window);
  window.alert = function(message) {
    const text = String(message ?? "");
    nativeAlert(currentLanguage === "en" ? exact(text) : text);
  };

  function translateNode(node, restore) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const now = node.nodeValue;
    if (!originalText.has(node)) originalText.set(node, now);
    else if (lastEnglishText.has(node) && now !== lastEnglishText.get(node)) originalText.set(node, now);
    const source = originalText.get(node);
    if (restore) {
      if (node.nodeValue !== source) node.nodeValue = source;
      lastEnglishText.delete(node);
    } else {
      const translated = exact(source);
      // Keep translations already supplied by the site's original language switch.
      if (translated !== source) {
        if (node.nodeValue !== translated) node.nodeValue = translated;
        lastEnglishText.set(node, translated);
      } else if (node.nodeValue === source) {
        lastEnglishText.delete(node);
      }
    }
  }

  function translateElementAttrs(el, restore) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    for (const name of attrNames) {
      if (!el.hasAttribute(name)) continue;
      let store = originalAttrs.get(el);
      if (!store) { store = {}; originalAttrs.set(el, store); }
      const current = el.getAttribute(name);
      const last = lastEnglishAttrs.get(el) || {};
      if (!(name in store)) store[name] = current;
      else if (name in last && current !== last[name]) store[name] = current;
      if (restore) {
        if (current !== store[name]) el.setAttribute(name, store[name]);
        delete last[name];
      } else {
        const translated = exact(store[name]);
        if (translated !== store[name]) {
          if (current !== translated) el.setAttribute(name, translated);
          last[name] = translated;
        } else if (current === store[name]) {
          delete last[name];
        }
      }
      lastEnglishAttrs.set(el, last);
    }
  }

  function walk(root, restore) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) translateNode(root, restore);
    else if (root.nodeType === Node.ELEMENT_NODE) {
      translateElementAttrs(root, restore);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) translateNode(node, restore);
      root.querySelectorAll && root.querySelectorAll('*').forEach(el => translateElementAttrs(el, restore));
    }
  }

  function setLanguage(language) {
    currentLanguage = language === 'en' ? 'en' : 'sv';
    walk(document.body, currentLanguage === 'sv');
    document.documentElement.lang = currentLanguage;
    document.querySelectorAll('.language-option').forEach(button => {
      const active = button.dataset.lang === currentLanguage;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const searchLabel = document.querySelector('label[for="faqSearch"]');
    if (searchLabel) searchLabel.textContent = currentLanguage === 'en' ? 'Search questions and answers' : 'Sök bland frågor och svar';
    const searchHint = document.getElementById('faqSearchStatus');
    const searchInput = document.getElementById('faqSearch');
    if (searchHint && (!searchInput || !searchInput.value.trim())) {
      searchHint.textContent = currentLanguage === 'en' ? 'Enter a keyword to see relevant answers instantly.' : 'Skriv ett sökord så visas relevanta svar direkt.';
    }
  }

  // Capture all original content before applying a language, including content already in English.
  walk(document.body, true);
  document.querySelectorAll('.language-option').forEach(button => {
    button.addEventListener('click', () => setLanguage(button.dataset.lang));
  });

  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') {
        if (currentLanguage === 'en') translateNode(record.target, false);
      } else {
        record.addedNodes.forEach(node => {
          if (currentLanguage === 'en') walk(node, false);
          else walk(node, true);
        });
        if (record.type === 'attributes' && currentLanguage === 'en') translateElementAttrs(record.target, false);
      }
    }
  });
  observer.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:attrNames});
  window.pressNPopSetLanguage = setLanguage;
  setLanguage('sv');
})();


/* Small navigation quality-of-life improvements. */
document.addEventListener("keydown", function(event) {
  if (event.key === "Escape" && typeof closeSiteDetailMenu === "function") closeSiteDetailMenu();
});
document.addEventListener("click", function(event) {
  const menu = document.getElementById("siteDetailMenu");
  const toggle = document.querySelector(".site-menu-toggle");
  if (!menu || menu.hasAttribute("hidden")) return;
  if (!menu.contains(event.target) && toggle && !toggle.contains(event.target)) {
    if (typeof closeSiteDetailMenu === "function") closeSiteDetailMenu();
  }
});


/* PRESSN'POP — five-finger size finder */
(function(){
 const widths={
  "Square":[17,16,15,14,13,12,12,11,11,10,9,8],
  "Coffin":[16.5,16,15,14.5,14,12.5,12,11.5,11,10.5,9.5,8.5],
  "Almond Medium":[17,16,15,14,13,12.5,12,11.5,11,10.5,9.5,8.5],
  "Almond Short":[19,17.5,16,15,14.5,14,13.5,13,12,11,10,9],
  "Toes":[23,21.5,20.5,20,19,18,15,14,13,12,10.5,10,9,8,7]
 };
 const fingers=["Lillfinger","Ringfinger","Långfinger","Pekfinger","Tumme"];
 let type="",shape=""; const $=id=>document.getElementById(id);
 function step(which){["finderTypeStep","finderShapeStep","finderMeasureStep"].forEach(id=>$(id).hidden=id!==which);$("finderProgress").style.width=which==="finderTypeStep"?"33.33%":which==="finderShapeStep"?"66.66%":"100%";$("finderResult").hidden=true;}
 function closest(mm,arr){let best=0;arr.forEach((v,i)=>{if(Math.abs(v-mm)<Math.abs(arr[best]-mm))best=i;});return {index:best,width:arr[best],diff:Math.abs(arr[best]-mm)};}
 document.querySelectorAll("[data-finder-type]").forEach(btn=>btn.addEventListener("click",()=>{
  type=btn.dataset.finderType;document.querySelectorAll("[data-finder-type]").forEach(x=>x.classList.toggle("selected",x===btn));
  $("finderFingerGrid").hidden=type==="toes";$("finderToeMeasure").hidden=type!=="toes";
  if(type==="toes"){shape="Toes";$("finderMeasureStep").querySelector(".finder-measure-label").textContent="Mät tåtippen vid den bredaste punkten";$("finderHint").textContent="Skriv in bredden i millimeter för att få närmaste tåstorlek.";}
  else{step("finderShapeStep");$("finderShapeLabel").textContent="VÄLJ FORM PÅ DINA NAGLAR";return;}
  step("finderMeasureStep");
 }));
 document.querySelectorAll("[data-finder-shape]").forEach(btn=>btn.addEventListener("click",()=>{shape=btn.dataset.finderShape;document.querySelectorAll("[data-finder-shape]").forEach(x=>x.classList.toggle("selected",x===btn));$("finderMeasureStep").querySelector(".finder-measure-label").textContent="Börja med lillfingret och fortsätt mot tummen";$("finderHint").textContent="Fyll i alla fem mått för att få en samlad storlekslista.";step("finderMeasureStep");}));
 $("finderCalculate").addEventListener("click",()=>{
  const arr=widths[shape]; let results=[];
  if(type==="toes"){
   const mm=parseFloat(String($("finderToeInput").value).replace(",","."));
   if(!Number.isFinite(mm)||mm<7||mm>25){$("finderHint").textContent="Skriv ett mått mellan 7 och 25 mm.";return;}
   const r=closest(mm,arr); const size=r.index===0?"00":String(r.index-1);
   results=[{finger:"Tå",mm,size,width:r.width,diff:r.diff}];
  } else {
   const inputs=[...document.querySelectorAll(".finder-finger-measure")];
   const values=inputs.map(i=>parseFloat(String(i.value).replace(",",".")));
   const missing=values.findIndex(v=>!Number.isFinite(v)||v<7||v>25);
   if(missing!==-1){$("finderHint").textContent="Fyll i ett giltigt mått (7–25 mm) för "+fingers[missing].toLowerCase()+".";inputs[missing].focus();return;}
   results=values.map((mm,i)=>{const r=closest(mm,arr);return {finger:fingers[i],mm,size:String(r.index).padStart(2,"0"),width:r.width,diff:r.diff};});
  }
  const rows=results.map(r=>`<div class="finder-result-row"><span><b>${r.finger}</b><small>${String(r.mm).replace(".",",")} mm uppmätt · närmast ${String(r.width).replace(".",",")} mm</small></span><strong>${r.size}</strong></div>`).join("");
  $("finderResult").innerHTML=`<span class="finder-label">DIN STORLEKSKOMBINATION · ${shape}</span><div class="finder-result-list">${rows}</div><p class="finder-result-advice">Spara listan eller ta en skärmbild innan du går vidare till beställningen. Storlekarna är rekommendationer utifrån dina mått.</p>`;
  $("finderResult").hidden=false;$("finderHint").textContent="Klart! Alla dina mått är omräknade till storlekar.";
 });
 $("finderReset").addEventListener("click",()=>{type="";shape="";document.querySelectorAll(".finder-choice").forEach(x=>x.classList.remove("selected"));document.querySelectorAll(".finder-finger-measure").forEach(x=>x.value="");$("finderToeInput").value="";$("finderFingerGrid").hidden=false;$("finderToeMeasure").hidden=true;step("finderTypeStep");$("finderHint").textContent="Välj naglar eller tår för att börja.";});
})();

/* Contact form: send directly through the same FormSubmit AJAX endpoint as orders. */
(function(){
 const form=document.getElementById("pnpContactForm");
 if(!form)return;
 form.addEventListener("submit",async function(e){
  e.preventDefault();
  if(!form.reportValidity())return;
  const button=form.querySelector('button[type="submit"]');
  const note=document.getElementById("contactFormNote");
  const data=new FormData(form);
  const name=String(data.get("name")||"").trim();
  const email=String(data.get("email")||"").trim();
  const topic=String(data.get("topic")||"Allmän fråga");
  const message=String(data.get("message")||"").trim();
  const payload=new FormData();
  payload.append("_subject","PressN’Pop – Kontakt: "+topic);
  payload.append("_template","table");
  payload.append("_captcha","false");
  payload.append("_replyto",email);
  payload.append("name",name);
  payload.append("email",email);
  payload.append("Ärende",topic);
  payload.append("Meddelande",message);
  if(button){button.disabled=true;button.textContent="Skickar…";}
  if(note)note.textContent="Ditt meddelande skickas…";
  try{
   const response=await fetch("https://formsubmit.co/ajax/pressnpop.uf@gmail.com",{
    method:"POST",headers:{"Accept":"application/json"},body:payload
   });
   const result=await response.json().catch(()=>({}));
   const ok=response.ok&&(result.success===true||result.success==="true");
   if(!ok)throw new Error(result.message||("HTTP "+response.status));
   form.reset();
   if(note)note.textContent="Tack! Ditt meddelande har skickats till oss. Vi återkommer så snart vi kan.";
  }catch(error){
   console.warn("Kontaktformuläret kunde inte skickas:",error);
   if(note)note.textContent="Det gick inte att skicka just nu. Försök igen eller mejla pressnpop.uf@gmail.com.";
  }finally{
   if(button){button.disabled=false;button.textContent="Skicka meddelande ↗";}
  }
 });
})();

/* Scroll-linked ritual guide: original vector illustrations, no product photos */
(function(){
 const steps=[...document.querySelectorAll(".ritual-step")],core=document.getElementById("ritualVisualCore");
 if(!steps.length||!core)return;
 const number=document.getElementById("ritualVisualNumber"),caption=document.getElementById("ritualVisualCaption"),count=document.getElementById("ritualVisualCount"),art=document.getElementById("ritualIllustration");
 const drawings={
  "01":`<svg viewBox="0 0 360 360" role="img" aria-label="Illustration av en nagelbandsputtare"><path d="M83 258 Q180 230 277 258"/><path d="M112 242 L236 91 Q246 78 259 90 L267 98 Q277 110 265 122 L139 260"/><path d="M236 91 L265 122"/><path d="M105 263 Q180 284 255 263"/><path d="M90 291 Q180 313 270 291"/></svg>`,
  "02":`<svg viewBox="0 0 360 360" role="img" aria-label="Illustration av en nagelfil"><rect x="74" y="132" width="212" height="86" rx="43" transform="rotate(-24 180 175)"/><path d="M111 224 L251 162 M120 240 L260 178 M103 207 L243 145 M132 255 L272 193"/><path d="M99 146 Q180 108 261 146"/></svg>`,
  "03":`<svg viewBox="0 0 360 360" role="img" aria-label="Illustration av en alkoholpad"><rect x="98" y="74" width="164" height="212" rx="18"/><path d="M121 111 H239 M121 132 H218"/><path d="M145 182 Q180 150 215 182 Q180 216 145 182Z"/><path d="M180 158 V205 M155 182 H205"/><path d="M121 239 H239"/></svg>`,
  "04":`<svg viewBox="0 0 360 360" role="img" aria-label="Illustration av glue tabs och nagellim"><path d="M91 114 Q91 92 113 92 H171 Q193 92 193 114 V255 Q193 277 171 277 H113 Q91 277 91 255Z"/><path d="M111 92 V70 H173 V92 M111 139 H173"/><rect x="214" y="128" width="55" height="132" rx="13"/><path d="M221 128 V101 H262 V128 M229 101 V82 H254 V101"/><path d="M241 260 Q241 285 258 293"/></svg>`,
  "05":`<svg viewBox="0 0 360 360" role="img" aria-label="Illustration av press-on naglar som får sätta sig"><path d="M102 240 Q102 151 180 151 Q258 151 258 240 Q258 270 230 270 H130 Q102 270 102 240Z"/><path d="M145 150 V110 Q145 82 180 82 Q215 82 215 110 V150"/><path d="M180 55 V34 M130 75 L116 59 M230 75 L244 59"/><path d="M150 211 Q180 192 210 211"/></svg>`,
  "06":`<svg viewBox="0 0 360 360" role="img" aria-label="Illustration av en förvaringsask med press-on naglar"><rect x="75" y="116" width="210" height="152" rx="18"/><path d="M75 157 H285 M103 116 V96 Q103 82 119 82 H241 Q257 82 257 96 V116"/><path d="M122 195 Q122 174 140 174 Q158 174 158 195 V225 H122Z M169 195 Q169 174 187 174 Q205 174 205 195 V225 H169Z M216 195 Q216 174 234 174 Q252 174 252 195 V225 H216Z"/></svg>`
 };
 let active="";
 function activate(step){const n=step.dataset.step;if(active===n)return;active=n;steps.forEach(s=>s.classList.toggle("is-active",s===step));core.classList.remove("is-changing");void core.offsetWidth;core.classList.add("is-changing");number.textContent=n;caption.textContent=step.dataset.caption||"PRESSN’POP";count.textContent=n+" / 06";art.innerHTML=drawings[n]||drawings["01"];const bar=document.querySelector(".ritual-progress span");if(bar)bar.style.width=(Number(n)/steps.length*100)+"%";window.setTimeout(()=>core.classList.remove("is-changing"),450);}
 let ticking=false;
 function update(){const target=window.innerHeight*.48;let best=steps[0],distance=Infinity;steps.forEach(s=>{const r=s.getBoundingClientRect();const center=r.top+Math.min(r.height,window.innerHeight)*.45;const d=Math.abs(center-target);if(d<distance){distance=d;best=s;}});activate(best);ticking=false;}
 function onScroll(){if(!ticking){window.requestAnimationFrame(update);ticking=true;}}
 window.addEventListener("scroll",onScroll,{passive:true});window.addEventListener("resize",onScroll);update();
})();

