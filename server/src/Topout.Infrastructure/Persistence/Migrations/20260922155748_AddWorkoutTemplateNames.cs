using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Topout.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkoutTemplateNames : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WorkoutDays_UserId_Name",
                table: "WorkoutDays");

            migrationBuilder.AddColumn<string>(
                name: "NormalizedName",
                table: "WorkoutDays",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            // Existing templates retain their contents. Conflicting names must be
            // resolved before upgrading; the migration fails transactionally otherwise.
            migrationBuilder.Sql("""UPDATE "WorkoutDays" SET "Name" = btrim("Name"), "NormalizedName" = upper(btrim("Name"));""");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutDays_UserId_NormalizedName",
                table: "WorkoutDays",
                columns: new[] { "UserId", "NormalizedName" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WorkoutDays_UserId_NormalizedName",
                table: "WorkoutDays");

            migrationBuilder.DropColumn(
                name: "NormalizedName",
                table: "WorkoutDays");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutDays_UserId_Name",
                table: "WorkoutDays",
                columns: new[] { "UserId", "Name" },
                unique: true);
        }
    }
}
