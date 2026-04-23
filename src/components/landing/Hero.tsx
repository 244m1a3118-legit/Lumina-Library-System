import { Container } from '@/src/components/ui/Container';
import { Button } from '@/components/ui/button';
import { motion } from 'motion/react';
import { ArrowRight, BookOpen, Users, ShieldCheck } from 'lucide-react';

export const Hero = () => {
  return (
    <section className="relative overflow-hidden py-24 lg:py-32">
      <Container className="relative z-10">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
              Modern Library Management <br />
              <span className="text-primary/60">Simplified for Everyone</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Catalog books, track members, and manage your library with ease. Lumina provides a powerful, intuitive interface for libraries of all sizes.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Button size="lg" className="h-12 px-8 text-base">
                Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                View Demo
              </Button>
            </div>
          </motion.div>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {[
            { icon: BookOpen, title: "Smart Cataloging", desc: "Automated book metadata retrieval and easy organization." },
            { icon: Users, title: "Member Tracking", desc: "Keep track of loans, returns, and member activity in real-time." },
            { icon: ShieldCheck, title: "Secure & Reliable", desc: "Your data is protected with enterprise-grade security." }
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
              className="rounded-2xl border bg-card p-8 shadow-sm transition-shadow hover:shadow-md"
            >
              <feature.icon className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold">{feature.title}</h3>
              <p className="mt-2 text-muted-foreground">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </Container>
      
      {/* Background decoration */}
      <div className="absolute top-0 -z-10 h-full w-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
    </section>
  );
};
