from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Category, SubCategory, Product,
    FertilizerDetail, PesticideDetail, SeedDetail, EquipmentDetail,
    UserAccount, Comment, Cart, CartItem
)


# ========================================
# Category Serializers
# ========================================
class SubCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = SubCategory
        fields = ['id', 'name', 'slug']


class CategorySerializer(serializers.ModelSerializer):
    subcategories = SubCategorySerializer(many=True, read_only=True)
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'image', 'subcategories', 'product_count']

    def get_product_count(self, obj):
        return obj.get_product_count()


# ========================================
# Product Detail Serializers
# ========================================
class FertilizerDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = FertilizerDetail
        fields = ['fertilizer_type', 'nitrogen', 'phosphorus', 'potassium']


class PesticideDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = PesticideDetail
        fields = ['pesticide_type', 'active_ingredient', 'concentration']


class SeedDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = SeedDetail
        fields = ['crop_type', 'variety', 'weight']


class EquipmentDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = EquipmentDetail
        fields = ['tool_type', 'material', 'weight']


# ========================================
# Product Serializer
# ========================================
class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    subcategory = SubCategorySerializer(read_only=True)
    author = serializers.StringRelatedField(read_only=True)
    image_url = serializers.SerializerMethodField()
    is_in_stock = serializers.SerializerMethodField()

    # ✅ اصلاح: source با underscore (مطابق related_name در models.py)
    fertilizer_detail = FertilizerDetailSerializer(read_only=True, source='fertilizer_detail')
    pesticide_detail = PesticideDetailSerializer(read_only=True, source='pesticide_detail')
    seed_detail = SeedDetailSerializer(read_only=True, source='seed_detail')
    equipment_detail = EquipmentDetailSerializer(read_only=True, source='equipment_detail')

    class Meta:
        model = Product
        fields = [
            'id', 'title', 'slug', 'author', 'category', 'subcategory',
            'description', 'publish', 'created', 'updated', 'status',
            'price', 'stock', 'available', 'is_featured', 'image', 'image_url',
            'is_in_stock', 'fertilizer_detail', 'pesticide_detail',
            'seed_detail', 'equipment_detail'
        ]
        read_only_fields = ['created', 'updated']

    def get_image_url(self, obj):
        return obj.image_url

    def get_is_in_stock(self, obj):
        return obj.is_in_stock


class ProductListSerializer(serializers.ModelSerializer):
    """Serializer سبک‌تر برای لیست محصولات"""
    category = serializers.StringRelatedField(read_only=True)
    image_url = serializers.SerializerMethodField()
    is_in_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'title', 'slug', 'category', 'price', 'stock',
            'available', 'is_featured', 'image', 'image_url', 'is_in_stock'
        ]

    def get_image_url(self, obj):
        return obj.image_url

    def get_is_in_stock(self, obj):
        return obj.is_in_stock


# ========================================
# Comment Serializer
# ========================================
class CommentSerializer(serializers.ModelSerializer):
    replies = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            'id', 'product', 'name', 'email', 'body', 'parent',
            'created', 'updated', 'active', 'replies'
        ]
        read_only_fields = ['created', 'updated', 'active']

    def get_replies(self, obj):
        replies = obj.replies.filter(active=True)
        return CommentSerializer(replies, many=True).data


# ========================================
# User Account Serializer
# ========================================
class UserAccountSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = UserAccount
        fields = [
            'id', 'username', 'email', 'full_name', 'phone',
            'gender', 'address', 'created', 'updated'
        ]
        read_only_fields = ['created', 'updated']

    def get_full_name(self, obj):
        return obj.user.get_full_name()


# ========================================
# Cart Serializers
# ========================================
class CartItemSerializer(serializers.ModelSerializer):
    product = ProductListSerializer(read_only=True)
    total_price = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = ['id', 'product', 'quantity', 'total_price']

    def get_total_price(self, obj):
        return obj.total_price


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total_price = serializers.SerializerMethodField()
    total_items = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = ['id', 'items', 'total_price', 'total_items', 'created_at', 'updated_at']

    def get_total_price(self, obj):
        return obj.total_price

    def get_total_items(self, obj):
        return obj.total_items


# ========================================
# Auth Serializers
# ========================================
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']
        read_only_fields = ['id']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'password', 'password2']

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError({"password": "رمزهای عبور مطابقت ندارند"})
        return data

    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            password=validated_data['password']
        )
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)