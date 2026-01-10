import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Eye, EyeOff, LogIn, Building2, Sparkles, Globe, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';
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
} from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Form schemas
const orgSchema = z.object({
    subdomain: z
        .string()
        .min(2, 'Subdomain must be at least 2 characters')
        .max(50, 'Subdomain must be less than 50 characters')
        .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens allowed'),
});

const credentialsSchema = z.object({
    email: z
        .string()
        .min(1, 'Email is required')
        .email('Please enter a valid email address'),
    password: z
        .string()
        .min(1, 'Password is required')
        .min(6, 'Password must be at least 6 characters'),
});

type OrgFormValues = z.infer<typeof orgSchema>;
type CredentialsFormValues = z.infer<typeof credentialsSchema>;

export function Login() {
    const navigate = useNavigate();
    const { login, setSubdomain, isLoading, clearError } = useAuthStore();
    const [step, setStep] = useState<'org' | 'credentials'>(
        localStorage.getItem('subdomain') ? 'credentials' : 'org'
    );
    const [currentSubdomain, setCurrentSubdomain] = useState(
        localStorage.getItem('subdomain') || ''
    );
    const [showPassword, setShowPassword] = useState(false);
    const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

    // Handle external redirection via effect to satisfy React Compiler purity rules
    useEffect(() => {
        if (redirectUrl) {
            window.location.href = redirectUrl;
        }
    }, [redirectUrl]);

    // Organization form
    const orgForm = useForm<OrgFormValues>({
        resolver: zodResolver(orgSchema),
        defaultValues: {
            subdomain: localStorage.getItem('subdomain') || '',
        },
    });

    // Credentials form
    const credentialsForm = useForm<CredentialsFormValues>({
        resolver: zodResolver(credentialsSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    const handleOrgSubmit = (values: OrgFormValues) => {
        const subdomain = values.subdomain.trim().toLowerCase();
        setSubdomain(subdomain);
        setCurrentSubdomain(subdomain);
        setStep('credentials');
    };

    const handleLogin = async (values: CredentialsFormValues) => {
        try {
            const result = await login(values.email, values.password);

            if (result && result.redirectUrl) {
                setRedirectUrl(result.redirectUrl);
                return;
            }

            navigate('/chat');
        } catch (err: unknown) {
            let errorMsg = 'Login failed. Please check your credentials.';
            if (err && typeof err === 'object' && 'response' in err) {
                const axiosError = err as { response?: { data?: { error?: string } } };
                errorMsg = axiosError.response?.data?.error || errorMsg;
            }
            toast.error(errorMsg);
        }
    };

    const handleChangeOrg = () => {
        setStep('org');
        clearError();
        credentialsForm.reset();
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Panel - Branding */}
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

                    <div className="max-w-md space-y-6 text-center">
                        <div className="flex items-start gap-4 text-left bg-white/10 backdrop-blur rounded-xl p-4 transition-all hover:bg-white/15">
                            <Sparkles className="h-6 w-6 mt-0.5 flex-shrink-0" />
                            <div>
                                <h3 className="font-semibold mb-1">Real-time Messaging</h3>
                                <p className="text-sm text-white/70">Instant communication with your team, anywhere.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4 text-left bg-white/10 backdrop-blur rounded-xl p-4 transition-all hover:bg-white/15">
                            <Building2 className="h-6 w-6 mt-0.5 flex-shrink-0" />
                            <div>
                                <h3 className="font-semibold mb-1">Multi-tenant Architecture</h3>
                                <p className="text-sm text-white/70">Complete data isolation for your organization.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Decorative Elements */}
                <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute -top-32 -right-32 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl" />
            </div>

            {/* Right Panel - Login Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-background">
                <div className="w-full max-w-md">
                    {/* Mobile Logo */}
                    <div className="lg:hidden text-center mb-8">
                        <div className="inline-flex h-16 w-16 bg-gradient-to-br from-primary to-purple-600 rounded-xl items-center justify-center mb-4">
                            <Building2 className="h-8 w-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold">WorkNest</h1>
                    </div>

                    {/* Organization Step */}
                    {step === 'org' && (
                        <Card className="border-0 shadow-lg animate-in fade-in slide-in-from-right-4 duration-300">
                            <CardHeader className="text-center space-y-1 pb-4">
                                <CardTitle className="text-2xl">Welcome back</CardTitle>
                                <CardDescription>
                                    Enter your organization's subdomain to continue
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Form {...orgForm}>
                                    <form onSubmit={orgForm.handleSubmit(handleOrgSubmit)} className="space-y-6">
                                        <FormField
                                            control={orgForm.control}
                                            name="subdomain"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Organization Subdomain</FormLabel>
                                                    <div className="flex items-center gap-2">
                                                        <div className="relative flex-1">
                                                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                            <FormControl>
                                                                <Input
                                                                    placeholder="your-company"
                                                                    className="pl-10"
                                                                    {...field}
                                                                    onChange={(e) => field.onChange(e.target.value.toLowerCase())}
                                                                />
                                                            </FormControl>
                                                        </div>
                                                        <span className="text-muted-foreground text-sm whitespace-nowrap">.worknest.com</span>
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <Button type="submit" className="w-full">
                                            Continue
                                        </Button>

                                        <p className="text-center text-sm text-muted-foreground">
                                            Don't have an organization?{' '}
                                            <Link to="/register" className="text-primary hover:underline font-medium">
                                                Create one
                                            </Link>
                                        </p>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>
                    )}

                    {/* Credentials Step */}
                    {step === 'credentials' && (
                        <Card className="border-0 shadow-lg animate-in fade-in slide-in-from-right-4 duration-300">
                            <CardHeader className="text-center space-y-1 pb-4">
                                <CardTitle className="text-2xl">Sign in to {currentSubdomain}</CardTitle>
                                <CardDescription>
                                    Enter your credentials to access your workspace
                                </CardDescription>
                                <Button
                                    variant="link"
                                    onClick={handleChangeOrg}
                                    className="text-sm p-0 h-auto"
                                >
                                    Change organization
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <Form {...credentialsForm}>
                                    <form onSubmit={credentialsForm.handleSubmit(handleLogin)} className="space-y-6">

                                        <FormField
                                            control={credentialsForm.control}
                                            name="email"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Email</FormLabel>
                                                    <div className="relative">
                                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <FormControl>
                                                            <Input
                                                                type="email"
                                                                placeholder="you@company.com"
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
                                            control={credentialsForm.control}
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
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <Button
                                            type="submit"
                                            className="w-full"
                                            disabled={isLoading}
                                        >
                                            {isLoading ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                                                    <span>Signing in...</span>
                                                </div>
                                            ) : (
                                                <span className="flex items-center gap-2">
                                                    <LogIn className="h-4 w-4" />
                                                    Sign in
                                                </span>
                                            )}
                                        </Button>

                                        <div className="text-center text-sm">
                                            <Button variant="link" className="p-0 h-auto text-sm">
                                                Forgot your password?
                                            </Button>
                                        </div>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>
                    )}

                    {/* Demo Credentials */}
                    <Card className="mt-6 border-0 bg-muted/50">
                        <CardContent className="pt-6">
                            <p className="text-sm font-medium mb-2">Demo Credentials:</p>
                            <div className="text-xs text-muted-foreground space-y-1">
                                <p><strong>Subdomain:</strong> zoho, infosys, or techstart</p>
                                <p><strong>Email:</strong> admin@[subdomain].com</p>
                                <p><strong>Password:</strong> password123</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

export default Login;
