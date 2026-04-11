import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactFormSchema, type ContactForm } from "@shared/schema";
import { Mail, Phone, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { RevealOnScroll } from "@/components/reveal-on-scroll";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { useTranslation } from "react-i18next";

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const { t } = useTranslation();

  const contactInfo = [
    {
      icon: Mail,
      label: t("contact.info_email_label"),
      value: "hello@restaurantgrowth.ai",
      href: "mailto:hello@restaurantgrowth.ai",
    },
    {
      icon: Phone,
      label: t("contact.info_phone_label"),
      value: "(555) 123-4567",
      href: "tel:+15551234567",
    },
    {
      icon: Clock,
      label: t("contact.info_response_label"),
      value: t("contact.info_response_value"),
      href: null,
    },
  ];

  const nextSteps = [
    t("contact.next_step_1"),
    t("contact.next_step_2"),
    t("contact.next_step_3"),
    t("contact.next_step_4"),
  ];

  const form = useForm<ContactForm>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      restaurantName: "",
      phone: "",
      primaryChallenge: "",
      message: "",
    },
  });

  function onSubmit(data: ContactForm) {
    if (typeof window !== "undefined" && (window as any).analytics) {
      (window as any).analytics.track("contact_form_submitted", data);
    }
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <section className="pt-32 pb-16 bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <Badge variant="secondary" className="mb-4">{t("contact.badge")}</Badge>
              <h1
                className="font-serif text-4xl sm:text-5xl font-bold text-foreground leading-tight"
                data-testid="text-contact-headline"
              >
                {t("contact.headline_1")} <span className="text-primary">{t("contact.headline_highlight")}</span>
              </h1>
              <p className="mt-5 text-muted-foreground text-lg leading-relaxed">
                {t("contact.hero_sub")}
              </p>
            </div>
          </div>
        </section>

        <section className="py-16 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              <div className="lg:col-span-2">
                {submitted ? (
                  <RevealOnScroll>
                    <Card>
                      <CardContent className="p-8 flex flex-col items-center text-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center">
                          <CheckCircle className="w-8 h-8 text-secondary" />
                        </div>
                        <h2
                          className="font-serif text-2xl font-bold"
                          data-testid="text-contact-success"
                        >
                          {t("contact.success_heading")}
                        </h2>
                        <p className="text-muted-foreground max-w-md">
                          {t("contact.success_desc")}
                        </p>
                      </CardContent>
                    </Card>
                  </RevealOnScroll>
                ) : (
                  <RevealOnScroll>
                    <Card>
                      <CardContent className="p-6 md:p-8">
                        <Form {...form}>
                          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                              <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t("contact.form_name")}</FormLabel>
                                    <FormControl>
                                      <Input placeholder={t("contact.form_name_ph")} {...field} data-testid="input-contact-name" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t("contact.form_email")}</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="email"
                                        placeholder={t("contact.form_email_ph")}
                                        {...field}
                                        data-testid="input-contact-email"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                              <FormField
                                control={form.control}
                                name="restaurantName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t("contact.form_restaurant")}</FormLabel>
                                    <FormControl>
                                      <Input placeholder={t("contact.form_restaurant_ph")} {...field} data-testid="input-contact-restaurant" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t("contact.form_phone")}</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="tel"
                                        placeholder={t("contact.form_phone_ph")}
                                        {...field}
                                        data-testid="input-contact-phone"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <FormField
                              control={form.control}
                              name="primaryChallenge"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t("contact.form_challenge")}</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-contact-challenge">
                                        <SelectValue placeholder={t("contact.form_challenge_ph")} />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="delivery-optimization">{t("contact.challenge_delivery")}</SelectItem>
                                      <SelectItem value="menu-improving">{t("contact.challenge_menu")}</SelectItem>
                                      <SelectItem value="social-media-operation">{t("contact.challenge_social")}</SelectItem>
                                      <SelectItem value="social-influencer">{t("contact.challenge_influencer")}</SelectItem>
                                      <SelectItem value="reputation">{t("contact.challenge_reputation")}</SelectItem>
                                      <SelectItem value="loyalty-program">{t("contact.challenge_loyalty")}</SelectItem>
                                      <SelectItem value="new-launch">{t("contact.challenge_launch")}</SelectItem>
                                      <SelectItem value="all">{t("contact.challenge_all")}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="message"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t("contact.form_message")}</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder={t("contact.form_message_ph")}
                                      className="min-h-[120px]"
                                      {...field}
                                      data-testid="textarea-contact-message"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <Button
                              type="submit"
                              className="w-full"
                              data-testid="button-contact-submit"
                            >
                              {t("contact.form_submit")}
                            </Button>
                          </form>
                        </Form>
                      </CardContent>
                    </Card>
                  </RevealOnScroll>
                )}
              </div>

              <div className="space-y-6">
                <RevealOnScroll direction="right">
                  <div>
                    <h2 className="font-serif text-xl font-bold mb-4" data-testid="text-contact-info-headline">
                      {t("contact.info_heading")}
                    </h2>
                    <div className="space-y-4">
                      {contactInfo.map((info, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <info.icon className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{info.label}</p>
                            {info.href ? (
                              <a
                                href={info.href}
                                className="text-foreground font-medium text-sm hover-elevate"
                                data-testid={`link-contact-${info.label.toLowerCase()}`}
                              >
                                {info.value}
                              </a>
                            ) : (
                              <p className="text-foreground font-medium text-sm">{info.value}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </RevealOnScroll>

                <RevealOnScroll direction="right" delay={0.1}>
                  <Card>
                    <CardContent className="p-5">
                      <h3 className="font-semibold mb-3 text-sm" data-testid="text-next-steps">{t("contact.next_steps_heading")}</h3>
                      <ol className="space-y-3">
                        {nextSteps.map((step, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <p className="text-muted-foreground text-xs leading-relaxed">{step}</p>
                          </li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                </RevealOnScroll>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
