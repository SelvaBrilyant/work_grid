import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Eye, EyeOff, UserPlus, Lock, User } from 'lucide-react';
import { authApi } from '@/lib/api';
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

const acceptInviteSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

type AcceptInviteValues = z.infer<typeof acceptInviteSchema>;

export function AcceptInvite() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { fetchUser } = useAuthStore();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const token = searchParams.get('token');

    const form = useForm<AcceptInviteValues>({
        resolver: zodResolver(acceptInviteSchema),
        defaultValues: {
            name: '',
            password: '',
            confirmPassword: '',
        },
    });

    useEffect(() => {
        if (!token) {
            setError('Invalid or missing invitation token.');
        }
    }, [token]);

    const onSubmit = async (values: AcceptInviteValues) => {
        if (!token) return;

        setIsLoading(true);
        setError(null);

        try {
            const { data } = await authApi.activate({
                token,
                newPassword: values.password,
                name: values.name
            });

            if (data.success) {
                localStorage.setItem('token', data.data.token);
                await fetchUser();
                navigate('/chat');
            }
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } } };
            setError(error.response?.data?.error || 'Failed to accept invitation. It may have expired.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!token && !isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
                <Card className="max-w-md w-full text-center">
                    <CardHeader>
                        <CardTitle className="text-destructive text-2xl font-bold">Invalid Invitation</CardTitle>
                        <CardDescription>
                            This invitation link is invalid or has expired. Please ask your administrator for a new invite.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => navigate('/login')} className="w-full">
                            Go to Login
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4">
            <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
                <CardHeader className="text-center">
                    <div className="mx-auto h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <UserPlus className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Complete Your Profile</CardTitle>
                    <CardDescription>
                        You've been invited to join the team. Set up your account to get started.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            {error && (
                                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
                                    {error}
                                </div>
                            )}

                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Full Name</FormLabel>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <FormControl>
                                                <Input placeholder="John Doe" className="pl-10" {...field} />
                                            </FormControl>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Choose Password</FormLabel>
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
                                                    type={showPassword ? 'text' : 'password'}
                                                    placeholder="••••••••"
                                                    className="pl-10"
                                                    {...field}
                                                />
                                            </FormControl>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <Button type="submit" className="w-full h-11 text-lg" disabled={isLoading}>
                                {isLoading ? (
                                    <span className="flex items-center gap-2">
                                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                                        Creating account...
                                    </span>
                                ) : (
                                    'Join Workspace'
                                )}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}

export default AcceptInvite;
