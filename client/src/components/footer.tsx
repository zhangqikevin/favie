import { Link } from "wouter";
import { Utensils, Phone, Mail, FlaskConical } from "lucide-react";
import { SiInstagram, SiFacebook, SiTiktok } from "react-icons/si";
import { services } from "@/data/services";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/language-switcher";

export default function Footer() {
  const { t } = useTranslation();

  const companyLinks = [
    { labelKey: "footer.about",        href: "/about" },
    { labelKey: "nav.view_capabilities", href: "/services", label: "Services" },
    { labelKey: "nav.who_we_serve",    href: "/industries" },
    { labelKey: "nav.results",         href: "/results" },
    { labelKey: "footer.faq",          href: "/faq" },
    { labelKey: "common.contact",      href: "/contact" },
  ];

  return (
    <footer className="bg-[#2A2A2A] text-white/80" data-testid="footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Utensils className="w-5 h-5 text-primary" />
              <span className="font-serif text-xl font-bold text-white">Favie</span>
            </div>
            <p className="text-white/55 text-sm leading-relaxed mb-6">
              {t("footer.desc")}
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">{t("footer.services")}</h4>
            <ul className="space-y-2">
              {services.map((service) => (
                <li key={service.slug}>
                  <Link
                    href={`/services/${service.slug}`}
                    className="text-white/55 text-sm hover-elevate transition-colors"
                    data-testid={`link-footer-service-${service.slug}`}
                  >
                    {service.shortTitle}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">{t("footer.company")}</h4>
            <ul className="space-y-2">
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-white/55 text-sm hover-elevate transition-colors"
                    data-testid={`link-footer-${t(link.labelKey).toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">{t("footer.contact")}</h4>
            <div className="space-y-3">
              <a
                href="tel:+15551234567"
                className="flex items-center gap-2 text-white/55 text-sm hover-elevate transition-colors"
                data-testid="link-footer-phone"
              >
                <Phone className="w-4 h-4 flex-shrink-0" />
                (555) 123-4567
              </a>
              <a
                href="mailto:hello@restaurantgrowth.ai"
                className="flex items-center gap-2 text-white/55 text-sm hover-elevate transition-colors"
                data-testid="link-footer-email"
              >
                <Mail className="w-4 h-4 flex-shrink-0" />
                hello@restaurantgrowth.ai
              </a>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <a
                href="#"
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover-elevate transition-colors"
                aria-label="Instagram"
                data-testid="link-social-instagram"
              >
                <SiInstagram className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover-elevate transition-colors"
                aria-label="Facebook"
                data-testid="link-social-facebook"
              >
                <SiFacebook className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover-elevate transition-colors"
                aria-label="TikTok"
                data-testid="link-social-tiktok"
              >
                <SiTiktok className="w-4 h-4" />
              </a>
              <Link
                href="/ubereats-lab"
                className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover-elevate transition-all opacity-30 hover:opacity-80"
                aria-label="Lab"
                data-testid="link-ubereats-lab"
              >
                <FlaskConical className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 space-y-4">
          {/* Language switcher */}
          <div className="flex items-center gap-2">
            <span className="text-white/35 text-xs">{t("footer.language")}:</span>
            <LanguageSwitcher variant="light" />
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/35 text-xs" data-testid="text-copyright">
              {t("footer.copyright", { year: new Date().getFullYear() })}
            </p>
            <p className="text-white/35 text-xs text-center">
              {t("footer.disclaimer")}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
