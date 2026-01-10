import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Eye,
    EyeOff,
    Building2,
    Check,
    ArrowRight,
    ArrowLeft,
    User,
    Mail,
    Lock,
    Globe,
    Sparkles,
    Rocket,
    Users,
    MessageSquare,
    Shield
} from 'lucide-react';
import { useAuthStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

// Form schemas for each step
const step1Schema = z.object({
    organizationName: z
        .string()
        .min(2, 'Organization name must be at least 2 characters')
        .max(100, 'Organization name must be less than 100 characters'),
    subdomain: z
        .string()
        .min(3, 'Subdomain must be at least 3 characters')
        .max(50, 'Subdomain must be less than 50 characters')
        .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens allowed'),
});

const step2Schema = z.object({
    name: z
        .string()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name must be less than 100 characters'),
    email: z
        .string()
        .min(1, 'Email is required')
        .email('Please enter a valid email address'),
});

// Combined schema for the full form
const fullFormSchema = step1Schema.merge(step2Schema).merge(
    z.object({
        password: z.string().min(6, 'Password must be at least 6 characters'),
        confirmPassword: z.string(),
    })
).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

type FormValues = z.infer<typeof fullFormSchema>;

const TOTAL_STEPS = 3;

export function Register() {
    const navigate = useNavigate();
    const { register, isLoading, error, clearError } = useAuthStore();

    const [currentStep, setCurrentStep] = useState(1);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(fullFormSchema),
        defaultValues: {
            organizationName: '',
            subdomain: '',
            name: '',
            email: '',
            password: '',
            confirmPassword: '',
        },
        mode: 'onTouched',
    });

    const validateStep = async (step: number): Promise<boolean> => {
        let fieldsToValidate: (keyof FormValues)[] = [];

        if (step === 1) {
            fieldsToValidate = ['organizationName', 'subdomain'];
        } else if (step === 2) {
            fieldsToValidate = ['name', 'email'];
        } else if (step === 3) {
            fieldsToValidate = ['password', 'confirmPassword'];
        }

        const result = await form.trigger(fieldsToValidate);
        return result;
    };

    const handleNext = async () => {
        const isValid = await validateStep(currentStep);
        if (isValid) {
            setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
        }
    };

    const handleBack = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 1));
        clearError();
    };

    const handleSubmit = async (values: FormValues) => {
        try {
            await register({
                organizationName: values.organizationName,
                subdomain: values.subdomain,
                name: values.name,
                email: values.email,
                password: values.password,
            });
            navigate('/chat');
        } catch {
            // Error handled in store
        }
    };

    const progressValue = (currentStep / TOTAL_STEPS) * 100;

    const steps = [
        { number: 1, title: 'Organization', icon: Building2 },
        { number: 2, title: 'Your Details', icon: User },
        { number: 3, title: 'Security', icon: Lock },
    ];

    const features = [
        { icon: MessageSquare, title: 'Real-time Messaging', description: 'Instant communication with your team' },
        { icon: Users, title: 'Team Channels', description: 'Organize conversations by topic' },
        { icon: Shield, title: 'Enterprise Security', description: 'Bank-level data protection' },
        { icon: Globe, title: 'Multi-tenant', description: 'Complete data isolation' },
    ];

    return (
        <div className="min-h-screen flex">
            {/* Left Panel - Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-background">
                <div className="w-full max-w-lg">
                    {/* Mobile Logo */}
                    <div className="lg:hidden text-center mb-8">
                        <div className="inline-flex h-16 w-16 bg-gradient-to-br from-primary to-purple-600 rounded-xl items-center justify-center mb-4">
                            <Building2 className="h-8 w-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold">WorkNest</h1>
                    </div>

                    {/* Step Indicator */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                            {steps.map((step, index) => (
                                <div key={step.number} className="flex items-center">
                                    <div className="flex flex-col items-center">
                                        <div
                                            className={`
                                                flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300
                                                ${currentStep > step.number
                                                    ? 'bg-primary border-primary text-primary-foreground'
                                                    : currentStep === step.number
                                                        ? 'border-primary text-primary bg-primary/10'
                                                        : 'border-muted-foreground/30 text-muted-foreground'
                                                }
                                            `}
                                        >
                                            {currentStep > step.number ? (
                                                <Check className="h-5 w-5" />
                                            ) : (
                                                <step.icon className="h-5 w-5" />
                                            )}
                                        </div>
                                        <span className={`text-xs mt-2 font-medium ${currentStep >= step.number ? 'text-foreground' : 'text-muted-foreground'
                                            }`}>
                                            {step.title}
                                        </span>
                                    </div>
                                    {index < steps.length - 1 && (
                                        <div className={`
                                            w-16 sm:w-24 h-0.5 mx-2 mt-[-1rem] transition-all duration-300
                                            ${currentStep > step.number ? 'bg-primary' : 'bg-muted-foreground/30'}
                                        `} />
                                    )}
                                </div>
                            ))}
                        </div>
                        <Progress value={progressValue} className="h-1" />
                    </div>

                    {/* Form Card */}
                    <Card className="border-0 shadow-lg">
                        <CardHeader className="space-y-1 pb-4">
                            <CardTitle className="text-2xl">
                                {currentStep === 1 && 'Create your workspace'}
                                {currentStep === 2 && 'Tell us about yourself'}
                                {currentStep === 3 && 'Secure your account'}
                            </CardTitle>
                            <CardDescription>
                                {currentStep === 1 && 'Set up your organization on WorkNest'}
                                {currentStep === 2 && "You'll be the admin of this workspace"}
                                {currentStep === 3 && 'Choose a strong password to protect your account'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                                    {error && (
                                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-in fade-in slide-in-from-top-2">
                                            {error}
                                        </div>
                                    )}

                                    {/* Step 1: Organization */}
                                    {currentStep === 1 && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                            <FormField
                                                control={form.control}
                                                name="organizationName"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Organization Name</FormLabel>
                                                        <div className="relative">
                                                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                            <FormControl>
                                                                <Input
                                                                    placeholder="Acme Corporation"
                                                                    className="pl-10"
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                        </div>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="subdomain"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Workspace URL</FormLabel>
                                                        <div className="flex items-center gap-2">
                                                            <div className="relative flex-1">
                                                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                                <FormControl>
                                                                    <Input
                                                                        placeholder="acme"
                                                                        className="pl-10"
                                                                        {...field}
                                                                        onChange={(e) => field.onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                                                    />
                                                                </FormControl>
                                                            </div>
                                                            <span className="text-muted-foreground text-sm whitespace-nowrap">.worknest.com</span>
                                                        </div>
                                                        <FormDescription>
                                                            Only lowercase letters, numbers, and hyphens
                                                        </FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}

                                    {/* Step 2: Personal Details */}
                                    {currentStep === 2 && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                            <FormField
                                                control={form.control}
                                                name="name"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Your Name</FormLabel>
                                                        <div className="relative">
                                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                            <FormControl>
                                                                <Input
                                                                    placeholder="John Doe"
                                                                    className="pl-10"
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                        </div>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="email"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Work Email</FormLabel>
                                                        <div className="relative">
                                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                            <FormControl>
                                                                <Input
                                                                    type="email"
                                                                    placeholder="john@acme.com"
                                                                    className="pl-10"
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                        </div>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}

                                    {/* Step 3: Security */}
                                    {currentStep === 3 && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                            <FormField
                                                control={form.control}
                                                name="password"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Password</FormLabel>
                                                        <div className="relative">
                                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                            <FormControl>
                                                                <Input
                                                                    type={showPassword ? 'text' : 'password'}
                                                                    placeholder="••••••••"
                                                                    className="pl-10 pr-10"
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setShowPassword(!showPassword)}
                                                                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                                            >
                                                                {showPassword ? (
                                                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                                ) : (
                                                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                                                )}
                                                            </Button>
                                                        </div>
                                                        <FormDescription>At least 6 characters</FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="confirmPassword"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Confirm Password</FormLabel>
                                                        <div className="relative">
                                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                            <FormControl>
                                                                <Input
                                                                    type={showConfirmPassword ? 'text' : 'password'}
                                                                    placeholder="••••••••"
                                                                    className="pl-10 pr-10"
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                                            >
                                                                {showConfirmPassword ? (
                                                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                                ) : (
                                                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                                                )}
                                                            </Button>
                                                        </div>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}

                                    {/* Navigation Buttons */}
                                    <div className="flex gap-3 pt-2">
                                        {currentStep > 1 && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={handleBack}
                                                className="flex-1"
                                            >
                                                <ArrowLeft className="h-4 w-4 mr-2" />
                                                Back
                                            </Button>
                                        )}
                                        {currentStep < TOTAL_STEPS ? (
                                            <Button
                                                type="button"
                                                onClick={handleNext}
                                                className="flex-1"
                                            >
                                                Continue
                                                <ArrowRight className="h-4 w-4 ml-2" />
                                            </Button>
                                        ) : (
                                            <Button
                                                type="submit"
                                                className="flex-1"
                                                disabled={isLoading}
                                            >
                                                {isLoading ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                                                        <span>Creating workspace...</span>
                                                    </div>
                                                ) : (
                                                    <span className="flex items-center gap-2">
                                                        <Rocket className="h-4 w-4" />
                                                        Create Workspace
                                                    </span>
                                                )}
                                            </Button>
                                        )}
                                    </div>

                                    <p className="text-center text-sm text-muted-foreground pt-2">
                                        Already have an account?{' '}
                                        <Link to="/login" className="text-primary hover:underline font-medium">
                                            Sign in
                                        </Link>
                                    </p>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Right Panel - Branding */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-purple-600 to-indigo-700 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M54.627 0l.83.828-1.415 1.415L51.8 0h2.827zM5.373 0l-.83.828L5.96 2.243 8.2 0H5.374zM48.97 0l3.657 3.657-1.414 1.414L46.143 0h2.828zM11.03 0L7.372 3.657 8.787 5.07 13.857 0H11.03zm32.284 0L49.8 6.485 48.384 7.9l-7.9-7.9h2.83zM16.686 0L10.2 6.485 11.616 7.9l7.9-7.9h-2.83zM22.344 0L13.858 8.485 15.272 9.9l9.9-9.9h-2.828zM32 0l-3.657 3.657 1.414 1.414L35.828 0H32zm-6.344 0L17.172 8.485 18.586 9.9l9.9-9.9h-2.83zM38.686 0l-9.9 9.9 1.415 1.414 10.828-10.828L38.686 0zm-14.343 0L14.515 9.828l1.414 1.414L27.172 0h-2.83z' fill='%23fff' fill-rule='evenodd'/%3E%3C/svg%3E")`,
                    }} />
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col items-center justify-center w-full p-12 text-white">
                    <div className="mb-12">
                        <div className="h-20 w-20 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mb-6">
                            <Building2 className="h-10 w-10" />
                        </div>
                        <h1 className="text-4xl font-bold mb-2">WorkNest</h1>
                        <p className="text-white/80 text-lg">Enterprise Team Chat</p>
                    </div>

                    <div className="max-w-md w-full space-y-4">
                        {features.map((feature) => (
                            <div key={feature.title} className="flex items-start gap-4 bg-white/10 backdrop-blur rounded-xl p-4 transition-all hover:bg-white/15">
                                <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                                    <feature.icon className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-0.5">{feature.title}</h3>
                                    <p className="text-sm text-white/70">{feature.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-12 text-center">
                        <div className="flex items-center justify-center gap-2 text-white/80">
                            <Sparkles className="h-4 w-4" />
                            <p className="text-sm">Free forever • No credit card required</p>
                        </div>
                    </div>
                </div>

                {/* Decorative Elements */}
                <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl" />
            </div>
        </div>
    );
}

export default Register;
